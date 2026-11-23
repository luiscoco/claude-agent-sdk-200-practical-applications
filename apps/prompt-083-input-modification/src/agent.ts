import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, outputSchema, rewriteWrite } from './rewrite.js';
import { publicReport } from './privacy.js';

export async function runInputRewrite(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/rewrite-'));
  const originalInput = {
    file_path: path.join(workspace, 'requested-note.txt'),
    content: `Draft ${requestedInput.topic} classroom note.\n`,
  };
  const effectiveInput = rewriteWrite(
    originalInput,
    requestedInput.mode,
    workspace,
    requestedInput.topic,
  );
  const preTool: Array<{ id: string; original: unknown; returned: unknown }> = [];
  const postTool: Array<{ id: string; input: unknown; response: unknown }> = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; isError: boolean; content: unknown }> = [];
  const permissionRequests: Array<{ id: string; name: string }> = [];
  const guardDecisions: Array<{ id: string; name: string; admitted: boolean }> = [];
  let writeId: string | null = null,
    readId: string | null = null;
  let rawOutput: unknown,
    sessionId = '',
    success = false,
    error = '',
    resultStatus = '';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 180000);
  const run = query({
    prompt: `This is an owned synthetic classroom experiment. Call Write exactly once with precisely these arguments: ${JSON.stringify(originalInput)}. A pre-tool hook may change the actual arguments. After Write succeeds, call Read exactly once on the actual file path reported by the successful Write result, even if different from your original request. Then report completed, the actual basename and exact text returned by Read including the trailing newline. Do not create another file, retry or call other tools.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: ['Write', 'Read'],
      allowedTools: ['Write', 'Read'],
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      settings: {
        permissions: {
          blockReadsOutsideWorkingDirectories: true,
          blockWritesOutsideWorkingDirectories: true,
        },
      },
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 7,
      maxBudgetUsd: 0.8,
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
            matcher: 'Write|Read',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const args = input.tool_input as Record<string, unknown>;
                if (input.tool_name === 'Write') {
                  const admitted =
                    isDeepStrictEqual(args, originalInput) &&
                    (!writeId || writeId === input.tool_use_id);
                  guardDecisions.push({ id: input.tool_use_id, name: 'Write', admitted });
                  if (!admitted)
                    return {
                      hookSpecificOutput: {
                        hookEventName: 'PreToolUse',
                        permissionDecision: 'deny',
                        permissionDecisionReason:
                          'Only the original owned classroom Write is admitted.',
                      },
                    };
                  writeId = input.tool_use_id;
                  const updatedInput = rewriteWrite(
                    args as typeof originalInput,
                    requestedInput.mode,
                    workspace,
                    requestedInput.topic,
                  );
                  const returned =
                    requestedInput.mode === 'original'
                      ? {}
                      : {
                          hookSpecificOutput: {
                            hookEventName: 'PreToolUse' as const,
                            updatedInput,
                          },
                        };
                  preTool.push({
                    id: input.tool_use_id,
                    original: structuredClone(args),
                    returned,
                  });
                  return returned;
                }
                const admitted =
                  typeof args.file_path === 'string' &&
                  path.resolve(workspace, args.file_path) === effectiveInput.file_path &&
                  (!readId || readId === input.tool_use_id);
                guardDecisions.push({ id: input.tool_use_id, name: 'Read', admitted });
                if (admitted) {
                  readId = input.tool_use_id;
                  return {};
                }
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason:
                      'Only the actual rewritten classroom file may be read.',
                  },
                };
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: 'Write',
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse')
                  postTool.push({
                    id: input.tool_use_id,
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
          if (block.type === 'tool_use' && ['Write', 'Read'].includes(block.name))
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
  const readOwned = async (file: string) => {
    try {
      return await readFile(file, 'utf8');
    } catch (failure) {
      if ((failure as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw failure;
    }
  };
  const requestedFileText = await readOwned(originalInput.file_path),
    effectiveFileText = await readOwned(effectiveInput.file_path);
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const writeCalls = calls.filter((call) => call.name === 'Write'),
    readCalls = calls.filter((call) => call.name === 'Read');
  const checks = {
    oneActualWriteAndRead:
      writeCalls.length === 1 && readCalls.length === 1 && results.length === 2,
    assistantOriginallyRequestedDraft: isDeepStrictEqual(writeCalls[0]?.input, originalInput),
    preHookReceivedOriginalArguments:
      preTool.length > 0 &&
      preTool.every(
        (item) => item.id === writeCalls[0]?.id && isDeepStrictEqual(item.original, originalInput),
      ),
    hookReturnedExpectedArguments:
      preTool.length > 0 &&
      preTool.every((item) =>
        isDeepStrictEqual(
          item.returned,
          requestedInput.mode === 'original'
            ? {}
            : { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: effectiveInput } },
        ),
      ),
    postHookReceivedEffectiveArguments:
      postTool.length === 1 &&
      postTool[0].id === writeCalls[0]?.id &&
      isDeepStrictEqual(postTool[0].input, effectiveInput),
    actualEffectiveFileMatches: effectiveFileText === effectiveInput.content,
    requestedFilePresenceMatches:
      originalInput.file_path === effectiveInput.file_path
        ? requestedFileText === effectiveInput.content
        : requestedFileText === null,
    actualReadUsedEffectivePath:
      (readCalls[0]?.input as Record<string, unknown>)?.file_path === effectiveInput.file_path,
    nativeToolsSucceeded: results.length === 2 && results.every((result) => !result.isError),
    onlyExpectedCallsAdmitted:
      guardDecisions.length >= 2 && guardDecisions.every((item) => item.admitted),
    preapprovalPreserved: permissionRequests.length === 0,
    finalMatchesIndependentFile: isDeepStrictEqual(output, {
      status: 'completed',
      file: path.basename(effectiveInput.file_path),
      text: effectiveFileText,
    }),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      originalInput,
      expectedEffectiveInput: effectiveInput,
      configuration: {
        tools: ['Write', 'Read'],
        allowedTools: ['Write', 'Read'],
        permissionMode: 'default',
        explicitHookPermissionOverride: false,
      },
      preTool,
      postTool,
      calls,
      results,
      guardDecisions,
      permissionRequests,
      fileEvidence: {
        requestedFile: path.basename(originalInput.file_path),
        requestedFileText,
        effectiveFile: path.basename(effectiveInput.file_path),
        effectiveFileText,
        hostCreatedOutputFiles: false,
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
