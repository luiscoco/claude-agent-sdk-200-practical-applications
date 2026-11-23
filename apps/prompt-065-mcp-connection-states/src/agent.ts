import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { auditEvents } from './states.js';
import { publicReport } from './privacy.js';

export const inputSchema = z.object({ message: z.string().trim().min(1).max(160) }).strict();
const outputSchema = z
  .object({
    phase: z.enum(['tool-timeout', 'success']),
    message: z.string(),
    workMs: z.number().int(),
    processId: z.number().int().nullable(),
  })
  .strict();
const outcomeSchema = outputSchema.omit({ phase: true }).extend({ processId: z.number().int() });
function nativeOutcome(content: unknown) {
  const texts =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((block) => block?.type === 'text').map((block) => String(block.text))
        : [];
  for (const text of texts) {
    try {
      const parsed = outcomeSchema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {}
  }
  return null;
}

export async function inspectToolCall(value: unknown, repaired: boolean) {
  const requestedInput = inputSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/tool-call-'));
  const auditFile = path.join(workspace, 'audit.jsonl');
  const timeoutMs = repaired ? 5000 : 1000;
  const expectedInput = { message: requestedInput.message, workMs: 3000 };
  const toolName = 'mcp__worker__echo';
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const decisions: Array<{ id: string; allowed: boolean }> = [];
  const results: Array<{ toolUseId: string; isError: boolean; content: unknown }> = [];
  let admitted = false;
  let nativeServerStatus: Awaited<ReturnType<Query['mcpServerStatus']>> = [];
  let connectedBeforeCall = false;
  let run: Query | undefined;
  let rawOutput: unknown;
  let success = false;
  let sessionId = '',
    resultStatus = '',
    error = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);
  try {
    run = query({
      prompt: `Call ${toolName} exactly once with ${JSON.stringify(expectedInput)}. Do not retry. If the actual tool request times out, return phase tool-timeout, message as the requested message, workMs as 3000 and processId null. Otherwise return phase success and copy the actual tool result fields.`,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        settingSources: [],
        strictMcpConfig: true,
        persistSession: false,
        mcpServers: {
          worker: {
            type: 'stdio',
            command: process.execPath,
            args: [path.join(root, 'src/mcp-server.mjs'), auditFile, '0'],
            timeout: timeoutMs,
            alwaysLoad: true,
          },
        },
        allowedTools: [toolName],
        maxTurns: 5,
        maxBudgetUsd: 0.75,
        abortController: controller,
        env: {
          ...process.env,
          MCP_TIMEOUT: '60000',
          MCP_CONNECTION_NONBLOCKING: '0',
          MCP_CONNECT_TIMEOUT_MS: '60000',
          CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
        },
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
        },
        hooks: {
          PreToolUse: [
            {
              matcher: toolName,
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const allowed =
                    !admitted &&
                    input.tool_name === toolName &&
                    isDeepStrictEqual(input.tool_input, expectedInput);
                  decisions.push({ id: input.tool_use_id, allowed });
                  if (allowed) {
                    admitted = true;
                    nativeServerStatus = await run!.mcpServerStatus();
                    connectedBeforeCall = nativeServerStatus.some(
                      (server) => server.name === 'worker' && server.status === 'connected',
                    );
                  }
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: allowed ? 'allow' : 'deny',
                    },
                  };
                },
              ],
            },
          ],
        },
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init')
        nativeServerStatus = await run.mcpServerStatus();
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content)
          if (
            block.type === 'tool_result' &&
            calls.some((call) => call.id === block.tool_use_id && call.name === toolName)
          )
            results.push({
              toolUseId: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        sessionId = message.session_id;
        resultStatus = message.subtype;
        if (message.subtype === 'success') rawOutput = message.structured_output;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const events = await auditEvents(auditFile);
  const starts = events.filter((event) => event.event === 'tool-started');
  const completion = events.find((event) => event.event === 'tool-completed');
  const acceptedIds = decisions
    .filter((decision) => decision.allowed)
    .map((decision) => decision.id);
  const acceptedResults = results.filter((result) => acceptedIds.includes(result.toolUseId));
  const parsed = outputSchema.safeParse(rawOutput);
  const output = parsed.success ? parsed.data : null;
  const nativeTimeoutObserved = acceptedResults.some(
    (result) => result.isError && /timed out|timeout/i.test(JSON.stringify(result.content)),
  );
  const nativeSuccessMatches = Boolean(
    completion &&
    acceptedResults.some(
      (result) =>
        !result.isError && isDeepStrictEqual(nativeOutcome(result.content), completion.outcome),
    ),
  );
  const finalMatches = repaired
    ? Boolean(
        output?.phase === 'success' &&
        completion &&
        isDeepStrictEqual(
          { message: output.message, workMs: output.workMs, processId: output.processId },
          completion.outcome,
        ),
      )
    : output?.phase === 'tool-timeout' &&
      output.message === expectedInput.message &&
      output.workMs === 3000 &&
      output.processId === null;
  const checks = {
    connectedBeforeCall,
    oneActualHandlerCall: starts.length === 1 && isDeepStrictEqual(starts[0].input, expectedInput),
    oneAdmittedCall: acceptedIds.length === 1,
    nativeOutcomeObserved: repaired ? nativeSuccessMatches : nativeTimeoutObserved,
    blockedRetriesReturnedErrors: decisions
      .filter((decision) => !decision.allowed)
      .every((decision) =>
        results.some((result) => result.toolUseId === decision.id && result.isError),
      ),
    finalMatches,
  };
  return publicReport(
    {
      mode: repaired ? 'success' : 'tool-timeout',
      stage: 'connected-tool-call',
      workspace,
      requestedInput,
      timeoutMs,
      expectedInput,
      nativeServerStatus,
      calls,
      decisions,
      results,
      events,
      output,
      checks,
      success,
      sessionId,
      resultStatus,
      error,
      verified: !error && success && Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
