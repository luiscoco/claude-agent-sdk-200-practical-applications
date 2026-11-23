import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import {
  pricingCellId,
  correctedSource,
  inspectNotebook,
  verifyCells,
  executePricingCell,
} from './notebook.js';

export async function editNotebook(mode: unknown) {
  if (mode !== 'edit' && mode !== 'missing')
    throw new Error('INVALID_MODE · Select the existing or deliberately missing cell.');
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/notebook-'));
  const target = path.join(workspace, 'checkout.ipynb');
  const original = path.join(workspace, 'before.ipynb');
  const baseline = await readFile(path.join(root, 'fixtures/checkout.ipynb'));
  await writeFile(original, baseline);
  await writeFile(target, baseline);
  const before = await inspectNotebook(original);
  const beforeExecution = await executePricingCell(root, original);
  if (!beforeExecution.executed)
    throw new Error(
      'PYTHON_VERIFICATION_UNAVAILABLE · Configure PYTHON_PATH. ' + beforeExecution.error,
    );
  const cellId = mode === 'missing' ? 'missing-cell' : pricingCellId;
  const permitted = (name: string, input: Record<string, unknown>) => {
    const file = name === 'Read' ? input.file_path : input.notebook_path;
    if (typeof file !== 'string') return false;
    const resolved = path.resolve(workspace, file);
    const matchesTarget =
      process.platform === 'win32'
        ? resolved.toLowerCase() === target.toLowerCase()
        : resolved === target;
    return (
      matchesTarget &&
      (name === 'Read' ||
        (name === 'NotebookEdit' &&
          input.cell_id === cellId &&
          input.edit_mode === 'replace' &&
          input.new_source === correctedSource))
    );
  };
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    name: string;
    toolUseId: string;
    isError: boolean;
    content: unknown;
  }> = [];
  const nativeEdits: unknown[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let sessionId = '';
  let success = false;
  let answer = '';
  let error = '';
  try {
    run = query({
      prompt: [
        'First use Read on ' + JSON.stringify(target) + '.',
        'Use native NotebookEdit with notebook_path ' +
          JSON.stringify(target) +
          ', cell_id ' +
          JSON.stringify(cellId) +
          ', edit_mode "replace" and this exact new_source ' +
          JSON.stringify(correctedSource) +
          '.',
        mode === 'missing'
          ? 'This is a deliberate missing-cell test. Attempt that exact replacement, preserve the actual tool error and stop.'
          : 'Use Read to inspect the updated notebook. Preserve the other cells, notebook metadata and selected cell metadata.',
        'Report the observed outcome briefly.',
      ].join('\n'),
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Read', 'NotebookEdit'],
        settingSources: [],
        mcpServers: {},
        maxTurns: 5,
        maxBudgetUsd: 0.75,
        abortController: controller,
        systemPrompt:
          'Perform the specified classroom notebook cell replacement with native Read and NotebookEdit. Use the exact supplied cell ID, edit mode and source. The missing-cell scenario deliberately exercises tool validation.',
        canUseTool: async (name, input) =>
          permitted(name, input)
            ? { behavior: 'allow', updatedInput: input }
            : {
                behavior: 'deny',
                message:
                  'Read the exact classroom notebook and apply only its specified cell replacement.',
              },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read|NotebookEdit',
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
                        },
                      }
                    : {},
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'NotebookEdit',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse')
                    nativeEdits.push(input.tool_response);
                  return {};
                },
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
              name: call.name,
              toolUseId: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
        }
      if (message.type === 'result') {
        sessionId = message.session_id;
        success = message.subtype === 'success' && !message.is_error;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const after = await inspectNotebook(target);
  const checks = verifyCells(before.notebook, after.notebook, mode);
  const afterExecution = checks.verified
    ? await executePricingCell(root, target)
    : {
        executed: false,
        result: null,
        stdout: '',
        stderr: '',
        error: 'CELL_VERIFICATION_FAILED · Inspect the actual notebook before execution.',
      };
  const nativeEditSucceeded = toolResults.some(
    (result) => result.name === 'NotebookEdit' && !result.isError,
  );
  const missingCellRejected = toolResults.some(
    (result) =>
      result.name === 'NotebookEdit' &&
      result.isError &&
      JSON.stringify(result.content).includes('missing-cell') &&
      JSON.stringify(result.content).includes('not found'),
  );
  const behaviorVerified =
    beforeExecution.result?.exampleTotalCents === 5000 &&
    beforeExecution.result?.additionalTotalCents === 3250 &&
    afterExecution.result?.exampleTotalCents === (mode === 'edit' ? 4000 : 5000) &&
    afterExecution.result?.additionalTotalCents === (mode === 'edit' ? 2750 : 3250);
  const verified =
    !error &&
    checks.verified &&
    behaviorVerified &&
    (mode === 'edit'
      ? success && nativeEditSucceeded
      : missingCellRejected && !nativeEditSucceeded && after.text === before.text);
  return {
    mode,
    workspace,
    target,
    cellId,
    correctedSource,
    before,
    after,
    checks,
    beforeExecution,
    afterExecution,
    calls,
    toolResults,
    nativeEdits,
    nativeEditSucceeded,
    missingCellRejected,
    behaviorVerified,
    success,
    answer,
    error,
    sessionId,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
