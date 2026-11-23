import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, outputSchema } from './approval.js';
import { ClassroomQuestions, type Answer } from './questions.js';
import { publicReport } from './privacy.js';

export async function runApproval(
  questions: ClassroomQuestions,
  controller: AbortController,
  value: unknown,
) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/approval-'));
  const outputFile = path.join(workspace, 'classroom-note.txt');
  const originalContent = `Draft ${requestedInput.topic} classroom note.\n`;
  const originalInput = { file_path: outputFile, content: originalContent };
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; name: string; isError: boolean; content: unknown }> = [];
  const observedRequests: Array<{ id: string; name: string; input: unknown; valid: boolean }> = [];
  const callbackEvents: Array<{
    id: string;
    name: string;
    originalInput: unknown;
    answer: Answer;
    effectiveInput: unknown;
  }> = [];
  let answer: Answer | undefined;
  let effectiveContent: string | null = null;
  const seen = new Set<string>();
  let initialTools: string[] = [],
    rawOutput: unknown;
  let success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  const timer = setTimeout(() => controller.abort(), 360000);
  const run = query({
    prompt: `Call Write exactly once using ${JSON.stringify(originalInput)}. The host will approve, deny or revise the actual requested content. After an actual successful Write, call Read exactly once on ${JSON.stringify(outputFile)} to verify the content that was actually written, then report completed and the exact text including trailing newlines. After an actual denial, report permission-denied and null text. Do not retry or call another tool. This is a synthetic owned classroom note.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: ['Write', 'Read'],
      allowedTools: [],
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 8,
      maxBudgetUsd: 0.85,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      canUseTool: async (name, input, options) => {
        if (name !== 'Write' || answer || !isDeepStrictEqual(input, originalInput)) {
          return {
            behavior: 'deny',
            message: 'Unexpected or additional classroom approval request.',
          };
        }
        answer = await questions.ask(
          'tool-permission',
          {
            toolName: name,
            toolUseId: options.toolUseID,
            nativeSessionId: sessionId,
            input,
            topic: requestedInput.topic,
          },
          controller.signal,
        );
        effectiveContent =
          answer.action === 'deny'
            ? null
            : answer.action === 'revise'
              ? answer.content
              : originalContent;
        const effectiveInput =
          effectiveContent === null ? null : { ...input, content: effectiveContent };
        callbackEvents.push({
          id: options.toolUseID,
          name,
          originalInput: input,
          answer,
          effectiveInput,
        });
        return effectiveInput
          ? { behavior: 'allow', updatedInput: effectiveInput }
          : {
              behavior: 'deny',
              message: 'CLASSROOM_APPROVAL_DENIED · The operator denied the actual Write.',
            };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write|Read',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const args = input.tool_input as Record<string, unknown>;
                const owned =
                  typeof args.file_path === 'string' &&
                  path.resolve(workspace, args.file_path) === outputFile;
                const valid =
                  owned &&
                  !seen.has(input.tool_name) &&
                  ((input.tool_name === 'Write' &&
                    isDeepStrictEqual(input.tool_input, originalInput)) ||
                    (input.tool_name === 'Read' && effectiveContent !== null));
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
                      'Unexpected classroom path, input or additional operation.',
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
  const actualText = await readFile(outputFile, 'utf8').catch((failure: NodeJS.ErrnoException) => {
    if (failure.code === 'ENOENT') return null;
    throw failure;
  });
  const parsed = outputSchema.safeParse(rawOutput);
  const modelOutput = parsed.success ? parsed.data : null;
  const denied = answer?.action === 'deny';
  const output = {
    status: denied ? 'permission-denied' : 'completed',
    text: actualText,
  };
  const modelEchoExact = isDeepStrictEqual(modelOutput, output);
  const write = results.find((result) => result.id === callbackEvents[0]?.id);
  const checks = {
    nativeSessionAssociated:
      Boolean(sessionId) &&
      questions.history.every((question) => question.payload.nativeSessionId === sessionId),
    nativeToolsAdvertised: ['Read', 'Write'].every((name) => initialTools.includes(name)),
    exactPendingApprovalAnswered:
      questions.history.length === 1 && questions.history[0].status === 'answered',
    oneNativeCallbackDecision: callbackEvents.length === 1,
    originalNativeWriteObserved: calls.some(
      (call) =>
        call.id === write?.id &&
        call.name === 'Write' &&
        isDeepStrictEqual(call.input, originalInput),
    ),
    nativeWriteOutcomeMatches: Boolean(write && write.isError === denied),
    actualFileMatchesEffectiveInput: actualText === effectiveContent,
    actualReadAfterApproval: denied
      ? !results.some((result) => result.name === 'Read')
      : results.some((result) => result.name === 'Read' && !result.isError),
    blockedAttemptsReturnedErrors: observedRequests
      .filter((request) => !request.valid)
      .every((request) => results.some((result) => result.id === request.id && result.isError)),
    recordedFileOutcomeMatchesApproval: isDeepStrictEqual(output, {
      status: denied ? 'permission-denied' : 'completed',
      text: effectiveContent,
    }),
    modelStatusMatches: modelOutput?.status === output.status,
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      initialTools,
      questions: questions.history,
      callbackEvents,
      observedRequests,
      calls,
      results,
      fileEvidence: {
        file: path.basename(outputFile),
        originalRequestedText: originalContent,
        effectiveContent,
        actualText,
        exists: actualText !== null,
      },
      output,
      modelOutput,
      modelEchoExact,
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
