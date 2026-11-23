import path from 'node:path';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, configuration, fixture, outputSchema } from './editing.js';
import { publicReport } from './privacy.js';

export async function runEditing(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/editing-'));
  const file = path.join(workspace, 'lesson-title.txt');
  const texts = fixture(requestedInput.topic);
  const planDirectory = path.join(workspace, 'native-config/plans');
  function ownedPlanPath(value: unknown) {
    if (requestedInput.mode !== 'plan' || typeof value !== 'string') return false;
    const relative = path.relative(planDirectory, path.resolve(workspace, value));
    return (
      Boolean(relative) &&
      !path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith('..' + path.sep) &&
      path.extname(relative) === '.md'
    );
  }
  await writeFile(file, texts.original);
  const selectedConfiguration = configuration(requestedInput.mode);
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; name: string; isError: boolean; content: unknown }> = [];
  const observedRequests: Array<{ id: string; name: string; input: unknown; valid: boolean }> = [];
  const permissionRequests: Array<{ id: string; name: string; input: unknown; decision: string }> =
    [];
  const seen = new Set<string>();
  let initialTools: string[] = [],
    rawOutput: unknown;
  let success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  const run = query({
    prompt: `Read ${JSON.stringify(file)} exactly once. Propose replacing its Draft title with Reviewed, preserving the topic and trailing newline. Respect the current permission mode. During planning, use the runtime-designated plan file when required, then return status planned and the exact proposedText with the source file preserved. When edits are permitted, use Edit exactly once to replace the original title with the proposed title. If the actual Edit succeeds return applied. If it is denied return permission-denied. Do not retry the source edit, exit planning, change modes or create another source file. This is an owned synthetic classroom file.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      ...selectedConfiguration,
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 10,
      maxBudgetUsd: 0.85,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      canUseTool: async (name, input, options) => {
        permissionRequests.push({ id: options.toolUseID, name, input, decision: 'deny' });
        return {
          behavior: 'deny',
          message: 'CLASSROOM_REVIEW_REQUIRED · This host preserves edits that require review.',
        };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Read|Edit|Write',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const args = input.tool_input as Record<string, unknown>;
                const owned =
                  typeof args.file_path === 'string' &&
                  path.resolve(workspace, args.file_path) === file;
                const exactEdit =
                  ((args.old_string === texts.original && args.new_string === texts.proposed) ||
                    (args.old_string === texts.original.trimEnd() &&
                      args.new_string === texts.proposed.trimEnd())) &&
                  args.replace_all !== true;
                const planFile = ownedPlanPath(args.file_path);
                const valid =
                  planFile ||
                  (!seen.has(input.tool_name) &&
                    owned &&
                    (input.tool_name === 'Read' || (input.tool_name === 'Edit' && exactEdit)));
                observedRequests.push({
                  id: input.tool_use_id,
                  name: input.tool_name,
                  input: input.tool_input,
                  valid,
                });
                if (valid) {
                  if (!planFile) seen.add(input.tool_name);
                  return {};
                }
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason:
                      'Unexpected classroom file, edit content or extra operation.',
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
          if (block.type !== 'tool_result') continue;
          const call = calls.find(
            (call) =>
              call.id === block.tool_use_id && ['Read', 'Edit', 'Write'].includes(call.name),
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
  const actualText = await readFile(file, 'utf8');
  const parsed = outputSchema.safeParse(rawOutput);
  const output = parsed.success ? parsed.data : null;
  const edits = calls.filter(
    (call) =>
      call.name === 'Edit' &&
      path.resolve(workspace, String((call.input as Record<string, unknown>).file_path)) === file,
  );
  const nativeEdit = results.find((result) => edits.some((edit) => edit.id === result.id));
  const planFiles = await readdir(planDirectory, { recursive: true }).catch(
    (failure: NodeJS.ErrnoException) => {
      if (failure.code === 'ENOENT') return [];
      throw failure;
    },
  );
  const planArtifacts = await Promise.all(
    planFiles
      .filter((name) => name.endsWith('.md'))
      .map(async (name) => ({
        relativeFile: path.join('native-config/plans', name),
        text: await readFile(path.join(planDirectory, name), 'utf8'),
      })),
  );
  const status =
    requestedInput.mode === 'plan'
      ? 'planned'
      : requestedInput.mode === 'accept-edits'
        ? 'applied'
        : 'permission-denied';
  const checks = {
    nativeReadAdvertised: initialTools.includes('Read'),
    nativeEditAdvertised: initialTools.includes('Edit'),
    actualReadSucceeded: results.some((result) => result.name === 'Read' && !result.isError),
    expectedEditAttempts: edits.length === (requestedInput.mode === 'plan' ? 0 : 1),
    nativeEditOutcomeMatches:
      requestedInput.mode === 'plan' ||
      Boolean(nativeEdit && nativeEdit.isError === (requestedInput.mode === 'edits-denied')),
    noApprovalCallbackNeeded: permissionRequests.length === 0,
    nativePlanWritesSucceeded: observedRequests
      .filter(
        (request) =>
          request.valid &&
          ownedPlanPath((request.input as Record<string, unknown>).file_path) &&
          request.name !== 'Read',
      )
      .every((request) => results.some((result) => result.id === request.id && !result.isError)),
    actualFileMatches:
      actualText === (requestedInput.mode === 'accept-edits' ? texts.proposed : texts.original),
    blockedAttemptsReturnedErrors: observedRequests
      .filter((request) => !request.valid)
      .every((request) => results.some((result) => result.id === request.id && result.isError)),
    finalMatches: isDeepStrictEqual(output, { status, proposedText: texts.proposed }),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      configuration: selectedConfiguration,
      initialTools,
      observedRequests,
      permissionRequests,
      calls,
      results,
      planArtifacts,
      fileEvidence: {
        file: path.basename(file),
        original: texts.original,
        proposed: texts.proposed,
        actualText,
        changed: actualText !== texts.original,
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
