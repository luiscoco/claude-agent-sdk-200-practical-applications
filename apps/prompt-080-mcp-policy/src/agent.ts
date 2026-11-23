import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  policyConfiguration,
  nativeToolName,
  noteText,
  outputSchema,
} from './policy.js';
import { publicReport } from './privacy.js';

export async function runPolicy(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/policy-'));
  const outputFile = path.join(workspace, 'classroom-note.txt');
  const configuration = policyConfiguration(requestedInput.mode);
  const expectedInput = { topic: requestedInput.topic };
  const executions: Array<{ input: unknown; text: string }> = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; name: string; isError: boolean; content: unknown }> = [];
  const observedRequests: Array<{ id: string; name: string; input: unknown; valid: boolean }> = [];
  const permissionRequests: Array<{ id: string; name: string; input: unknown; decision: string }> =
    [];
  const saveNote = tool(
    'save_note',
    'Save one synthetic owned classroom note and return its exact text.',
    {
      topic: z.enum(['MCP', 'Hooks']),
    },
    async (input) => {
      if (executions.length || !isDeepStrictEqual(input, expectedInput))
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Unexpected additional classroom execution.' }],
        };
      const text = noteText(input.topic);
      await writeFile(outputFile, text);
      executions.push({ input, text });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ saved: true, text }) }],
        structuredContent: { saved: true, text },
      };
    },
    {
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
  );
  const server = createSdkMcpServer({
    name: 'classroom',
    version: '1.0.0',
    tools: [saveNote],
    alwaysLoad: true,
  });
  let initialTools: string[] = [],
    nativePermissionMode = '',
    sessionId = '',
    resultStatus = '',
    error = '';
  let rawOutput: unknown,
    success = false;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 180000);
  const run = query({
    prompt: `If ${nativeToolName} is available, call it exactly once with ${JSON.stringify(expectedInput)}. It saves only a synthetic owned classroom note. After actual success report completed with the exact returned text including its trailing newline. After an actual native denial report permission-denied and null text. If the tool is absent report unavailable and null text. Never retry or use another tool.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: [],
      mcpServers: { classroom: { ...server, tools: configuration.tools } },
      allowedTools: configuration.allowedTools,
      permissionMode: configuration.permissionMode,
      allowDangerouslySkipPermissions: configuration.allowDangerouslySkipPermissions,
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: {
        ...process.env,
        CLAUDE_CODE_REMOTE: undefined,
        CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
        MCP_TIMEOUT: '60000',
        MCP_CONNECTION_NONBLOCKING: '0',
        CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
      },
      maxTurns: 6,
      maxBudgetUsd: 0.7,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      canUseTool: async (name, input, options) => {
        const approved =
          requestedInput.mode === 'ask-allow' &&
          name === nativeToolName &&
          isDeepStrictEqual(input, expectedInput) &&
          permissionRequests.length === 0;
        permissionRequests.push({
          id: options.toolUseID,
          name,
          input,
          decision: approved ? 'allow' : 'deny',
        });
        return approved
          ? { behavior: 'allow', updatedInput: input }
          : {
              behavior: 'deny',
              message:
                'CLASSROOM_POLICY_DENIED · The preselected host policy denied this actual MCP request.',
            };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'mcp__classroom__.*',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const valid =
                  input.tool_name === nativeToolName &&
                  isDeepStrictEqual(input.tool_input, expectedInput) &&
                  observedRequests.length === 0;
                observedRequests.push({
                  id: input.tool_use_id,
                  name: input.tool_name,
                  input: input.tool_input,
                  valid,
                });
                if (valid) return {};
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason:
                      'Unexpected MCP classroom input or additional operation.',
                  },
                };
              },
            ],
          },
        ],
      },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        initialTools = message.tools;
        nativePermissionMode = message.permissionMode;
        sessionId = message.session_id;
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
            (call) => call.id === block.tool_use_id && call.name === nativeToolName,
          );
          if (call)
            results.push({
              id: call.id,
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
            });
        }
      if (message.type === 'result') {
        sessionId = message.session_id;
        resultStatus = message.subtype;
        success = message.subtype === 'success' && !message.is_error;
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
  const actualText = await readFile(outputFile, 'utf8').catch((failure: NodeJS.ErrnoException) => {
    if (failure.code === 'ENOENT') return null;
    throw failure;
  });
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const advertised = initialTools.includes(nativeToolName);
  const allowed = ['preapproved', 'ask-allow'].includes(requestedInput.mode);
  const expectedCallbacks = ['ask-allow', 'ask-deny', 'bypass-ask'].includes(requestedInput.mode)
    ? 1
    : 0;
  const expectedOutput = {
    status: !advertised ? 'unavailable' : allowed ? 'completed' : 'permission-denied',
    text: allowed ? noteText(requestedInput.topic) : null,
  };
  const exactCalls = calls.filter(
    (call) => call.name === nativeToolName && isDeepStrictEqual(call.input, expectedInput),
  );
  const checks = {
    nativeModeMatches: nativePermissionMode === configuration.permissionMode,
    toolAvailabilityConsistent: advertised || requestedInput.mode === 'policy-deny',
    exactNativeCallCount: exactCalls.length === (advertised ? 1 : 0),
    nativePermissionCallbackCountMatches: permissionRequests.length === expectedCallbacks,
    nativePermissionDecisionMatches: permissionRequests.every(
      (request) =>
        request.id === exactCalls[0]?.id &&
        request.decision === (requestedInput.mode === 'ask-allow' ? 'allow' : 'deny'),
    ),
    handlerAdmissionMatchesPolicy: executions.length === (allowed ? 1 : 0),
    nativeToolResultMatchesPolicy:
      !advertised ||
      results.some((result) => result.id === exactCalls[0]?.id && result.isError === !allowed),
    actualFileMatchesPolicy: actualText === (allowed ? noteText(requestedInput.topic) : null),
    finalMatchesNativeOutcome: isDeepStrictEqual(output, expectedOutput),
  };
  return publicReport(
    {
      requestedInput,
      configuration,
      workspace,
      initialTools,
      nativePermissionMode,
      advertised,
      observedRequests,
      permissionRequests,
      calls,
      results,
      executions,
      fileEvidence: { file: 'classroom-note.txt', exists: actualText !== null, actualText },
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
