import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { ToolPreview } from './tool-preview.js';

export const expectedContent =
  Array.from(
    { length: 20 },
    (_, index) =>
      'Lesson line ' +
      String(index + 1).padStart(2, '0') +
      ' - tool arguments remain preview data while their JSON is still arriving.',
  ).join('\n') + '\n';
export type Observation = { type: string; detail: unknown };
export function validateMode(value: unknown) {
  if (value !== 'normal' && value !== 'truncated-preview')
    throw new Error('INVALID_MODE · Choose normal or truncated-preview.');
  return value;
}

export async function runToolStream(
  value: unknown,
  emit: (event: Observation) => void,
  controller = new AbortController(),
) {
  const mode = validateMode(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const runs = path.resolve(import.meta.dirname, '../runs');
  await mkdir(runs, { recursive: true });
  const workspace = await mkdtemp(path.join(runs, 'write-'));
  const target = path.join(workspace, 'notes.txt');
  const preview = new ToolPreview(mode === 'truncated-preview');
  const observations: Observation[] = [];
  const nativeInputs: { toolId: string; input: Record<string, unknown> }[] = [];
  const toolResults: unknown[] = [];
  const observe = (type: string, detail: unknown) => {
    const event = { type, detail };
    observations.push(event);
    emit(event);
  };
  const permitted = (input: Record<string, unknown>) => {
    if (typeof input.file_path !== 'string' || typeof input.content !== 'string') return false;
    const requestedPath = path.resolve(workspace, input.file_path);
    const samePath =
      process.platform === 'win32'
        ? requestedPath.toLowerCase() === target.toLowerCase()
        : requestedPath === target;
    return samePath && input.content.length <= 10000;
  };
  let messageId = '';
  let answer = '';
  let success = false;
  let error = '';
  let run: Query | undefined;
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    run = query({
      prompt:
        'Use Write once to create ' +
        JSON.stringify(target) +
        ' with this exact content string: ' +
        JSON.stringify(expectedContent) +
        '. Then reply with exactly WRITTEN.',
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Write'],
        mcpServers: {},
        settingSources: [],
        includePartialMessages: true,
        maxTurns: 4,
        maxBudgetUsd: 0.7,
        abortController: controller,
        systemPrompt:
          'Follow the requested file task precisely. Use the exact supplied path and content.',
        canUseTool: async (name, input) =>
          name === 'Write' && permitted(input)
            ? { behavior: 'allow', updatedInput: input }
            : { behavior: 'deny', message: 'Write only the classroom notes file.' },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Write',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const argumentsObject = input.tool_input as Record<string, unknown>;
                  const allowed = permitted(argumentsObject);
                  if (allowed) {
                    nativeInputs.push({ toolId: input.tool_use_id, input: argumentsObject });
                    observe('native-tool-request', {
                      toolId: input.tool_use_id,
                      input: argumentsObject,
                    });
                  }
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: allowed ? 'allow' : 'deny',
                      permissionDecisionReason: 'Write only the classroom notes file.',
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
                  if (input.hook_event_name !== 'PostToolUse') return {};
                  toolResults.push(input.tool_response);
                  observe('native-tool-result', input.tool_response);
                  return {};
                },
              ],
            },
          ],
        },
      },
    });
    for await (const message of run) {
      if (message.type === 'stream_event') {
        const event = message.event;
        if (event.type === 'message_start') messageId = event.message.id;
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          preview.start(
            messageId,
            event.index,
            event.content_block.id,
            event.content_block.name,
            event.content_block.input,
          );
          observe('tool-start', preview.snapshot());
        }
        if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
          preview.append(messageId, event.index, event.delta.partial_json);
          observe('argument-fragment', {
            fragment: event.delta.partial_json,
            blocks: preview.snapshot(),
          });
        }
        if (event.type === 'content_block_stop') {
          preview.complete(messageId, event.index);
          observe('block-stop', preview.snapshot());
        }
        if (event.type === 'message_stop') {
          preview.markIncomplete(messageId);
          observe('message-stop', preview.snapshot());
        }
      }
      if (message.type === 'result') {
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
        success = message.subtype === 'success' && !message.is_error;
        observe('result', { subtype: message.subtype, isError: message.is_error, answer });
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timeout);
    preview.markIncomplete();
    run?.close();
  }
  let fileContent = '';
  try {
    fileContent = await readFile(target, 'utf8');
  } catch (failure) {
    if ((failure as NodeJS.ErrnoException).code !== 'ENOENT') throw failure;
  }
  const blocks = preview.snapshot();
  const writtenExactly = fileContent === expectedContent;
  const previewVerified =
    blocks.length > 0 &&
    blocks.every(
      (block) =>
        block.state === 'complete' &&
        nativeInputs.some(
          (native) =>
            native.toolId === block.toolId && isDeepStrictEqual(native.input, block.arguments),
        ),
    );
  const scenarioVerified =
    mode === 'truncated-preview'
      ? blocks.length > 0 &&
        blocks.every(
          (block) => block.state === 'invalid' && block.parseError.startsWith('JSON_PREVIEW_ERROR'),
        )
      : previewVerified;
  const verified =
    success &&
    !error &&
    answer.trim() === 'WRITTEN' &&
    writtenExactly &&
    toolResults.length > 0 &&
    blocks.some((block) => block.fragments > 1) &&
    scenarioVerified;
  return {
    mode,
    workspace,
    target,
    blocks,
    nativeInputs,
    toolResults,
    fileContent,
    expectedContent,
    writtenExactly,
    previewVerified,
    success,
    answer,
    error,
    observations,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
