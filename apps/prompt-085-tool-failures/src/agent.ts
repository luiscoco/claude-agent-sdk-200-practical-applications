import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, outputSchema, nativeToolName, diagnosticFor } from './diagnostic.js';
import { publicReport } from './privacy.js';

export async function runToolFailure(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/failure-'));
  const expectedInput = { topic: requestedInput.topic };
  const expectedText = `Synthetic ${requestedInput.topic} classroom lookup note.\n`;
  const executions: Array<{ input: unknown; outcome: string }> = [];
  const failures: Array<{
    id: string;
    name: string;
    input: unknown;
    error: string;
    isInterrupt: boolean;
    diagnostic: ReturnType<typeof diagnosticFor>;
  }> = [];
  const successes: Array<{ id: string; name: string; input: unknown; response: unknown }> = [];
  const preTool: Array<{ id: string; admitted: boolean }> = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; isError: boolean; content: unknown }> = [];
  const permissionRequests: Array<{ id: string; name: string }> = [];
  const lookup = tool(
    'lookup_note',
    'Look up one synthetic owned classroom note and return its exact text, or an actual classroom error.',
    { topic: z.enum(['MCP', 'Hooks']) },
    async (input) => {
      if (executions.length || !isDeepStrictEqual(input, expectedInput))
        throw new Error('Unexpected additional classroom lookup.');
      executions.push({ input, outcome: requestedInput.mode });
      if (requestedInput.mode === 'returned-error')
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'CLASSROOM_NOT_FOUND · The owned synthetic note is missing.',
            },
          ],
        };
      if (requestedInput.mode === 'thrown-error')
        throw new Error(
          'CLASSROOM_STORE_OFFLINE · The owned synthetic classroom store is unavailable.',
        );
      return { content: [{ type: 'text' as const, text: expectedText }] };
    },
    {
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
  );
  const server = createSdkMcpServer({
    name: 'classroom',
    version: '1.0.0',
    tools: [lookup],
    alwaysLoad: true,
  });
  let admittedId: string | null = null,
    rawOutput: unknown,
    success = false,
    error = '',
    sessionId = '',
    resultStatus = '';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 180000);
  const run = query({
    prompt: `Call ${nativeToolName} exactly once with ${JSON.stringify(expectedInput)}. This is an owned synthetic classroom lookup. After actual success report completed, null errorCode and its exact text including trailing newline. After a tool execution error report tool-failed, the CLASSROOM error code found in the actual error, and null text. After a pre-execution permission denial report permission-denied, CLASSROOM_APPROVAL_DENIED, and null text. Never retry or use another tool.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: [],
      mcpServers: { classroom: server },
      allowedTools: ['mcp__classroom__*'],
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
        MCP_TIMEOUT: '60000',
        MCP_CONNECTION_NONBLOCKING: '0',
        CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
      },
      maxTurns: 5,
      maxBudgetUsd: 0.7,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      canUseTool: async (name, _input, options) => {
        permissionRequests.push({ id: options.toolUseID, name });
        return {
          behavior: 'deny',
          message: 'Unexpected host approval request in the preapproved classroom experiment.',
        };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'mcp__classroom__lookup_note',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const admitted =
                  requestedInput.mode !== 'permission-denied' &&
                  input.tool_name === nativeToolName &&
                  isDeepStrictEqual(input.tool_input, expectedInput) &&
                  (!admittedId || admittedId === input.tool_use_id);
                preTool.push({ id: input.tool_use_id, admitted });
                if (admitted) {
                  admittedId = input.tool_use_id;
                  return {};
                }
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason:
                      'CLASSROOM_APPROVAL_DENIED · The preselected classroom policy denied this lookup before execution.',
                  },
                };
              },
            ],
          },
        ],
        PostToolUseFailure: [
          {
            matcher: 'mcp__classroom__lookup_note',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PostToolUseFailure') return {};
                failures.push({
                  id: input.tool_use_id,
                  name: input.tool_name,
                  input: structuredClone(input.tool_input),
                  error: input.error,
                  isInterrupt: Boolean(input.is_interrupt),
                  diagnostic: diagnosticFor(input.error, input.is_interrupt),
                });
                return {};
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: 'mcp__classroom__lookup_note',
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse')
                  successes.push({
                    id: input.tool_use_id,
                    name: input.tool_name,
                    input: structuredClone(input.tool_input),
                    response: structuredClone(input.tool_response),
                  });
                return {};
              },
            ],
          },
        ],
      },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') sessionId = message.session_id;
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use' && block.name === nativeToolName)
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content)
          if (block.type === 'tool_result' && calls.some((call) => call.id === block.tool_use_id))
            results.push({
              id: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        sessionId = message.session_id;
        resultStatus = message.subtype;
        if (message.subtype === 'success') rawOutput = message.structured_output;
        else error = message.errors.join('\n');
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run.close();
  }
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const executionFailed = ['returned-error', 'thrown-error'].includes(requestedInput.mode),
    denied = requestedInput.mode === 'permission-denied';
  const errorCode =
    requestedInput.mode === 'returned-error'
      ? 'CLASSROOM_NOT_FOUND'
      : requestedInput.mode === 'thrown-error'
        ? 'CLASSROOM_STORE_OFFLINE'
        : denied
          ? 'CLASSROOM_APPROVAL_DENIED'
          : null;
  const checks = {
    oneActualNativeCall: calls.length === 1 && results.length === 1,
    actualInputMatches: isDeepStrictEqual(calls[0]?.input, expectedInput),
    handlerExecutionMatches: executions.length === (denied ? 0 : 1),
    nativeErrorMatches: results.length === 1 && results[0].isError === (executionFailed || denied),
    failureHookCountMatches: failures.length === (executionFailed ? 1 : 0),
    successHookCountMatches: successes.length === (requestedInput.mode === 'success' ? 1 : 0),
    failureCorrelatesWithNativeCall: failures.every(
      (item) =>
        item.id === calls[0]?.id &&
        item.name === nativeToolName &&
        isDeepStrictEqual(item.input, expectedInput),
    ),
    usefulDiagnosticMatches: failures.every(
      (item) =>
        item.diagnostic.code === errorCode &&
        item.diagnostic.retryable === (requestedInput.mode === 'thrown-error') &&
        item.diagnostic.nextStep.length > 10,
    ),
    preExecutionAdmissionMatches:
      preTool.length > 0 &&
      preTool.every((item) => item.id === calls[0]?.id && item.admitted === !denied),
    noAutomaticRetries: calls.length === 1 && executions.length <= 1,
    preapprovalAvoidedHostCallback: permissionRequests.length === 0,
    finalMatchesActualOutcome: isDeepStrictEqual(output, {
      status: denied ? 'permission-denied' : executionFailed ? 'tool-failed' : 'completed',
      errorCode,
      text: requestedInput.mode === 'success' ? expectedText : null,
    }),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      fixtureDisclosure:
        'Owned in-process synthetic classroom lookup; missing-note and offline failures are deliberate handler cases.',
      executions,
      failures,
      successes,
      preTool,
      calls,
      results,
      permissionRequests,
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
