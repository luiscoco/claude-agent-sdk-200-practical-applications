import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query, type McpServerStatus } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  createNoteServer,
  inspectProtocolAnnotations,
  nativeOutcome,
  outcomeSchema,
  requestSchema,
  stateSchema,
  toolAnnotations,
  type Execution,
} from './notes.js';

export async function runAnnotations(value: unknown) {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      'INVALID_INPUT · Select a note experiment, a bounded note value and the host deletion confirmation.',
    );
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const requestedInput = parsed.data;
  const directory = path.resolve(import.meta.dirname, '../runs');
  await mkdir(directory, { recursive: true });
  const workspace = await mkdtemp(path.join(directory, 'annotations-'));
  const stateFile = path.join(workspace, 'note.json');
  const initialState = { note: 'Original classroom note', revision: 0 };
  await writeFile(stateFile, JSON.stringify(initialState, null, 2) + '\n');
  const protocolTools = await inspectProtocolAnnotations(stateFile);
  const executions: Execution[] = [];
  const server = createNoteServer(stateFile, requestedInput.confirmDelete, executions);
  const names = {
    read: 'mcp__notes__read_note',
    'write-repeat': 'mcp__notes__set_note',
    delete: 'mcp__notes__delete_note',
  };
  const expectedName = names[requestedInput.mode];
  const expectedInput =
    requestedInput.mode === 'write-repeat' ? { value: requestedInput.value } : {};
  const expectedCount = requestedInput.mode === 'delete' && !requestedInput.confirmDelete ? 1 : 2;
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    name: string;
    isError: boolean;
    content: unknown;
    parsedOutcome: ReturnType<typeof nativeOutcome>;
  }> = [];
  const hookResults: Array<{ event: string; mcpServer: unknown }> = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let initialTools: string[] = [];
  let nativeServerStatus: McpServerStatus[] = [];
  let sessionId = '';
  let rawOutput: unknown;
  let success = false;
  let resultErrors: string[] = [];
  let error = '';
  let approvedCalls = 0;
  try {
    run = query({
      prompt: [
        'Call ' +
          expectedName +
          ' sequentially ' +
          expectedCount +
          ' time(s) with exact input ' +
          JSON.stringify(expectedInput) +
          '.',
        'Wait for each result before the next call. Preserve the actual outcome of the last call as structured output.',
        'If the handler reports a deletion confirmation error, preserve that actual error and finish.',
      ].join(' '),
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: { notes: server },
        allowedTools: Object.keys(toolAnnotations).map((name) => 'mcp__notes__' + name),
        settingSources: [],
        maxTurns: 6,
        maxBudgetUsd: 0.75,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outcomeSchema, { target: 'draft-7' }),
        },
        systemPrompt:
          'Use the registered classroom note tools for the exact experiment. Preserve the actual final tool outcome. The host controls deletion confirmation and records actual state fingerprints.',
        hooks: {
          PreToolUse: [
            {
              matcher: 'mcp__notes__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const permitted =
                    approvedCalls < expectedCount &&
                    input.tool_name === expectedName &&
                    isDeepStrictEqual(input.tool_input, expectedInput);
                  if (permitted) approvedCalls++;
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: permitted ? 'allow' : 'deny',
                    },
                  };
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'mcp__notes__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse')
                    hookResults.push({
                      event: input.hook_event_name,
                      mcpServer: input.mcp_server ?? null,
                    });
                  return {};
                },
              ],
            },
          ],
          PostToolUseFailure: [
            {
              matcher: 'mcp__notes__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUseFailure')
                    hookResults.push({
                      event: input.hook_event_name,
                      mcpServer: input.mcp_server ?? null,
                    });
                  return {};
                },
              ],
            },
          ],
        },
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        initialTools = message.tools;
        nativeServerStatus = await run.mcpServerStatus();
      }
      if (message.type === 'assistant')
        for (const block of message.message.content) {
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
        }
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = calls.find(
            (item) => item.id === block.tool_use_id && item.name === expectedName,
          );
          if (call)
            toolResults.push({
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
              parsedOutcome: nativeOutcome(block.content),
            });
        }
      if (message.type === 'result') {
        sessionId = message.session_id;
        success = message.subtype === 'success' && !message.is_error;
        resultErrors = success
          ? []
          : message.subtype === 'success'
            ? [message.result]
            : message.errors;
        rawOutput = message.subtype === 'success' ? message.structured_output : undefined;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
    await server.instance.close();
  }
  const finalState = stateSchema.parse(JSON.parse(await readFile(stateFile, 'utf8')));
  const parsedOutput = outcomeSchema.safeParse(rawOutput);
  const output = parsedOutput.success ? parsedOutput.data : null;
  const first = executions[0];
  const last = executions.at(-1);
  const blocked = requestedInput.mode === 'delete' && !requestedInput.confirmDelete;
  const stateBehaviorVerified =
    requestedInput.mode === 'read' || blocked
      ? isDeepStrictEqual(initialState, finalState) &&
        executions.every((item) => item.beforeSha256 === item.afterSha256)
      : executions.length === 2 &&
        first.afterSha256 === last?.afterSha256 &&
        last?.outcome.changed === false;
  const checks = {
    protocolAnnotationsMatch: Object.entries(toolAnnotations).every(([name, annotations]) =>
      isDeepStrictEqual(protocolTools.find((item) => item.name === name)?.annotations, annotations),
    ),
    allToolsDiscovered: Object.keys(toolAnnotations).every((name) =>
      initialTools.includes('mcp__notes__' + name),
    ),
    exactHandlerSequence:
      executions.length === expectedCount &&
      executions.every(
        (item) =>
          item.name === expectedName &&
          isDeepStrictEqual(item.input, expectedInput) &&
          item.processId === process.pid,
      ),
    nativeResultsMatch:
      executions.length === toolResults.length &&
      executions.every(
        (item, index) =>
          isDeepStrictEqual(toolResults[index]?.parsedOutcome, item.outcome) &&
          toolResults[index]?.isError === !item.outcome.ok,
      ),
    finalResultMatches: Boolean(last && isDeepStrictEqual(output, last.outcome)),
    stateBehaviorVerified,
    confirmationEnforced: blocked
      ? output?.errorCode === 'DELETE_CONFIRMATION_REQUIRED' &&
        isDeepStrictEqual(finalState, initialState)
      : output?.ok === true,
    sdkServerObserved: hookResults.some(
      (item) =>
        (item.mcpServer as { name?: string; source?: string } | null)?.name === 'notes' &&
        (item.mcpServer as { source?: string } | null)?.source === 'sdk',
    ),
  };
  const secret = process.env.ANTHROPIC_API_KEY;
  if (secret) {
    error = error.replaceAll(secret, '[REDACTED]');
    resultErrors = resultErrors.map((message) => message.replaceAll(secret, '[REDACTED]'));
  }
  return {
    requestedInput,
    workspace,
    stateFile,
    initialState,
    finalState,
    protocolTools,
    nativeServerStatus,
    executions,
    calls,
    toolResults,
    hookResults,
    initialTools,
    output,
    hostProcessId: process.pid,
    success,
    error,
    resultErrors,
    sessionId,
    checks,
    verified: !error && success && Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
  };
}
