import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  toolConfiguration,
  expectedWriteStatus,
  classroomText,
  outputSchema,
} from './handling.js';
import { publicReport } from './privacy.js';

export async function runHandling(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  }
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/availability-'));
  const inputFile = path.join(workspace, 'classroom-note.txt');
  const outputFile = path.join(workspace, 'classroom-report.txt');
  const text = classroomText(requestedInput.topic);
  await writeFile(inputFile, text);
  const configuration = toolConfiguration(requestedInput.mode);
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; name: string; isError: boolean; content: unknown }> = [];
  const observedRequests: Array<{ id: string; name: string; input: unknown; valid: boolean }> = [];
  const permissionRequests: Array<{ id: string; name: string; input: unknown; decision: string }> =
    [];
  const seen = new Set<string>();
  let initialTools: string[] = [];
  let rawOutput: unknown;
  let success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);
  const run = query({
    prompt: `Read ${JSON.stringify(inputFile)} exactly once. Copy its exact text, including the trailing newline, to ${JSON.stringify(outputFile)} using Write exactly once if Write is available. If Write is absent from your tools, report unavailable. If the actual Write call is denied, report permission-denied. If it succeeds, report completed. Do not retry, use another tool or invent a file operation. Return readStatus completed, the exact readText and the actual writeStatus. These are synthetic local classroom files.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      ...configuration,
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 8,
      maxBudgetUsd: 0.8,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      canUseTool: async (name, input, options) => {
        const approved = requestedInput.mode === 'default-allow';
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
              message: 'CLASSROOM_APPROVAL_DENIED · This run denies the requested write.',
            };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Read|Write',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const args = input.tool_input as Record<string, unknown>;
                const file =
                  typeof args.file_path === 'string' ? path.resolve(workspace, args.file_path) : '';
                const valid =
                  !seen.has(input.tool_name) &&
                  ((input.tool_name === 'Read' && file === inputFile) ||
                    (input.tool_name === 'Write' && file === outputFile && args.content === text));
                observedRequests.push({
                  id: input.tool_use_id,
                  name: input.tool_name,
                  input: input.tool_input,
                  valid,
                });
                if (valid) {
                  seen.add(input.tool_name);
                  return {};
                }
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason:
                      'Unexpected classroom file, content or extra operation.',
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
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
        }
      }
      if (message.type === 'user' && Array.isArray(message.message.content)) {
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = calls.find(
            (call) => call.id === block.tool_use_id && ['Read', 'Write'].includes(call.name),
          );
          if (call)
            results.push({
              id: call.id,
              name: call.name,
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
  const writtenText = await readFile(outputFile, 'utf8').catch((failure: NodeJS.ErrnoException) => {
    if (failure.code === 'ENOENT') return null;
    throw failure;
  });
  const writeStatus = expectedWriteStatus(requestedInput.mode);
  const writeAvailable = true;
  const valid = observedRequests.filter((request) => request.valid);
  const validResults = results.filter((result) =>
    valid.some((request) => request.id === result.id),
  );
  const parsed = outputSchema.safeParse(rawOutput);
  const output = parsed.success ? parsed.data : null;
  const checks = {
    readAdvertised: initialTools.includes('Read'),
    writeAdvertisementMatches: initialTools.includes('Write') === writeAvailable,
    exactReadObserved: valid.filter((request) => request.name === 'Read').length === 1,
    actualReadSucceeded: validResults.some((result) => result.name === 'Read' && !result.isError),
    writeAttemptMatches:
      valid.filter((request) => request.name === 'Write').length === Number(writeAvailable),
    callbackMatches: isDeepStrictEqual(
      permissionRequests.map((request) => request.name),
      requestedInput.mode.startsWith('default-') ? ['Write'] : [],
    ),
    nativeWriteOutcomeMatches:
      !writeAvailable ||
      validResults.some(
        (result) =>
          result.name === 'Write' && result.isError === (writeStatus === 'permission-denied'),
      ),
    callbackDecisionMatches: permissionRequests.every(
      (request) =>
        request.decision === (requestedInput.mode === 'default-allow' ? 'allow' : 'deny'),
    ),
    actualOutputFileMatches: writtenText === (writeStatus === 'completed' ? text : null),
    blockedAttemptsReturnedErrors: observedRequests
      .filter((request) => !request.valid)
      .every((request) => results.some((result) => result.id === request.id && result.isError)),
    finalMatches: isDeepStrictEqual(output, {
      readStatus: 'completed',
      readText: text,
      writeStatus,
    }),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      configuration,
      permissionMode: configuration.permissionMode,
      initialTools,
      observedRequests,
      permissionRequests,
      calls,
      results,
      fileEvidence: {
        inputFile: path.basename(inputFile),
        inputText: text,
        outputFile: path.basename(outputFile),
        exists: writtenText !== null,
        actualText: writtenText,
      },
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
