import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import {
  actualDiff,
  inspectSource,
  probePolicy,
  originalLine,
  editedLine,
  staleLine,
} from './source.js';
export async function editSource(mode: unknown, discount: unknown = 550) {
  if (mode !== 'edit' && mode !== 'stale')
    throw new Error('INVALID_MODE · Select the targeted edit or stale excerpt.');
  if (
    typeof discount !== 'number' ||
    !Number.isSafeInteger(discount) ||
    discount < 0 ||
    discount > 1000
  )
    throw new Error('INVALID_DISCOUNT · Enter integer cents from 0 through 1000.');
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  const runs = path.join(root, 'runs');
  await mkdir(runs, { recursive: true });
  const workspace = await mkdtemp(path.join(runs, 'edit-'));
  const target = path.join(workspace, 'pricing.ts');
  const baseline = await readFile(path.join(root, 'fixtures/pricing.ts'), 'utf8');
  await writeFile(path.join(workspace, 'before.ts'), baseline, 'utf8');
  await writeFile(target, baseline, 'utf8');
  const before = await inspectSource(target);
  const beforeBehavior = await probePolicy(target, before.sha256, discount);
  const oldSnippet = mode === 'stale' ? staleLine : originalLine;
  const permitted = (name: string, input: Record<string, unknown>) => {
    if (typeof input.file_path !== 'string') return false;
    const requested = path.resolve(workspace, input.file_path);
    if (name === 'Read') {
      const relative = path.relative(workspace, requested);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    }
    return (
      name === 'Edit' &&
      (process.platform === 'win32'
        ? requested.toLowerCase() === target.toLowerCase()
        : requested === target)
    );
  };
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    toolUseId: string;
    name: string;
    isError: boolean;
    content: unknown;
  }> = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let success = false;
  let answer = '';
  let error = '';
  let sessionId = '';
  try {
    run = query({
      prompt: [
        'First use Read on ' + JSON.stringify(target) + '.',
        'Use one targeted native Edit with old_string ' +
          JSON.stringify(oldSnippet) +
          ' and new_string ' +
          JSON.stringify(editedLine) +
          '.',
        mode === 'stale'
          ? 'This is a deliberate stale-excerpt test. Attempt that exact old_string even though it is absent. Preserve the native error and stop.'
          : 'Then use Read on the edited source to inspect the result. Preserve the rest of the source exactly.',
        'Report the observed edit outcome briefly.',
      ].join('\n'),
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Read', 'Edit'],
        mcpServers: {},
        settingSources: [],
        maxTurns: 6,
        maxBudgetUsd: 0.75,
        abortController: controller,
        systemPrompt:
          'Perform the specified classroom source edit with native Read and Edit. Use the exact supplied excerpt. The stale test deliberately exercises native Edit failure.',
        canUseTool: async (name, input) =>
          permitted(name, input)
            ? { behavior: 'allow', updatedInput: input }
            : {
                behavior: 'deny',
                message: 'Read the classroom workspace and edit only its pricing source.',
              },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read|Edit',
              hooks: [
                async (input) =>
                  input.hook_event_name === 'PreToolUse'
                    ? {
                        hookSpecificOutput: {
                          hookEventName: 'PreToolUse',
                          permissionDecision: permitted(
                            input.tool_name,
                            input.tool_input as Record<string, unknown>,
                          )
                            ? 'allow'
                            : 'deny',
                          permissionDecisionReason:
                            'Scope the classroom source edit to its working copy.',
                        },
                      }
                    : {},
              ],
            },
          ],
        },
      },
    });
    for await (const message of run) {
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = calls.find((call) => call.id === block.tool_use_id);
          if (call)
            toolResults.push({
              toolUseId: block.tool_use_id,
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
            });
        }
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
        sessionId = message.session_id;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const after = await inspectSource(target);
  const afterBehavior = await probePolicy(target, after.sha256, discount);
  const diff = await actualDiff(workspace);
  const expectedAfter =
    mode === 'edit' ? before.text.replace(originalLine, editedLine) : before.text;
  const exactChange = after.text === expectedAfter;
  const editObserved = calls.some((call) => call.name === 'Edit');
  const nativeEditFailed = toolResults.some((result) => result.name === 'Edit' && result.isError);
  const staleExcerptRejected = toolResults.some(
    (result) =>
      result.name === 'Edit' &&
      result.isError &&
      /String to replace not found/.test(
        typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
      ) &&
      JSON.stringify(result.content).includes(oldSnippet),
  );
  const nativeEditSucceeded = toolResults.some(
    (result) => result.name === 'Edit' && !result.isError,
  );
  const behaviorChecked =
    beforeBehavior.loaded &&
    beforeBehavior.limitCents === 500 &&
    afterBehavior.loaded &&
    afterBehavior.limitCents === (mode === 'edit' ? 600 : 500);
  const verified =
    exactChange &&
    editObserved &&
    behaviorChecked &&
    !diff.error &&
    (mode === 'edit'
      ? success && !error && nativeEditSucceeded && diff.exitCode === 1
      : staleExcerptRejected && !nativeEditSucceeded && diff.exitCode === 0);
  return {
    mode,
    discountCents: discount,
    workspace,
    target,
    oldSnippet,
    newSnippet: editedLine,
    before,
    after,
    beforeBehavior,
    afterBehavior,
    expectedAfter,
    exactChange,
    calls,
    toolResults,
    nativeEditFailed,
    staleExcerptRejected,
    nativeEditSucceeded,
    diff,
    success,
    answer,
    error,
    sessionId,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
