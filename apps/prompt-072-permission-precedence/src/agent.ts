import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  permissionRules,
  expectedStatus,
  classroomText,
  outputSchema,
} from './precedence.js';
import { publicReport } from './privacy.js';

export async function runPrecedence(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/precedence-'));
  const inputFile = path.join(workspace, 'classroom-note.txt');
  const text = classroomText(requestedInput.topic);
  await writeFile(inputFile, text);
  const rules = permissionRules(requestedInput.mode);
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; isError: boolean; content: unknown }> = [];
  const observedRequests: Array<{ id: string; input: unknown; valid: boolean }> = [];
  const permissionRequests: Array<{ id: string; name: string; input: unknown; decision: string }> =
    [];
  let seen = false;
  let initialTools: string[] = [];
  let rawOutput: unknown;
  let success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);
  const run = query({
    prompt: `Call Read exactly once on ${JSON.stringify(inputFile)}. This is a synthetic classroom note. Return the actual status completed and exact text including its trailing newline if the read succeeds. If the actual call is denied, return permission-denied and null text. Do not retry, use another tool or infer the file contents.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: ['Read'],
      settings: { permissions: rules },
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 6,
      maxBudgetUsd: 0.65,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      canUseTool: async (name, input, options) => {
        const approved = requestedInput.mode === 'ask-approved';
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
              message: 'CLASSROOM_ASK_DENIED · The host denied this approval request.',
            };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Read',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const args = input.tool_input as Record<string, unknown>;
                const valid =
                  !seen &&
                  typeof args.file_path === 'string' &&
                  path.resolve(workspace, args.file_path) === inputFile;
                observedRequests.push({ id: input.tool_use_id, input: input.tool_input, valid });
                if (valid) {
                  seen = true;
                  return {};
                }
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason: 'Unexpected classroom file or extra operation.',
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
      if (message.type === 'system' && message.subtype === 'init') initialTools = message.tools;
      if (message.type === 'assistant')
        for (const block of message.message.content) {
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
        }
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (
            block.type === 'tool_result' &&
            calls.some((call) => call.id === block.tool_use_id && call.name === 'Read')
          ) {
            results.push({
              id: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
          }
        }
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
  const valid = observedRequests.filter((request) => request.valid);
  const exactCalls = calls.filter((call) => {
    const args = call.input as Record<string, unknown>;
    return (
      call.name === 'Read' &&
      typeof args.file_path === 'string' &&
      path.resolve(workspace, args.file_path) === inputFile
    );
  });
  const native = results.find((result) => exactCalls.some((call) => call.id === result.id));
  const status = expectedStatus(requestedInput.mode);
  const callbackExpected = ['ask-denied', 'ask-approved'].includes(requestedInput.mode);
  const parsed = outputSchema.safeParse(rawOutput);
  const output = parsed.success ? parsed.data : null;
  const checks = {
    readAdvertised: initialTools.includes('Read'),
    exactReadAttemptObserved: exactCalls.length === 1,
    hookCountMatches: valid.length === (requestedInput.mode === 'deny-wins' ? 0 : 1),
    callbackCountMatches: permissionRequests.length === Number(callbackExpected),
    callbackDecisionMatches: permissionRequests.every(
      (request) =>
        request.name === 'Read' &&
        request.id === native?.id &&
        request.decision === (requestedInput.mode === 'ask-approved' ? 'allow' : 'deny'),
    ),
    nativeOutcomeMatches: Boolean(native && native.isError === (status === 'permission-denied')),
    successfulNativeTextMatches:
      status !== 'completed' || JSON.stringify(native?.content).includes(text.trim()),
    inputFilePreserved: (await readFile(inputFile, 'utf8')) === text,
    blockedAttemptsReturnedErrors: observedRequests
      .filter((request) => !request.valid)
      .every((request) => results.some((result) => result.id === request.id && result.isError)),
    finalMatches: isDeepStrictEqual(output, { status, text: status === 'completed' ? text : null }),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      rules,
      permissionMode: 'default',
      initialTools,
      observedRequests,
      permissionRequests,
      calls,
      results,
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
