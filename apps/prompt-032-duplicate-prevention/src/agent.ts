import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { TextRenderer, validateMode } from './renderer.js';

export const expectedText =
  'Render text deltas as they arrive.\nReconcile the completed block with its existing display.\nUse the SDK result to report the final turn status.';
export type Observation = { type: string; detail: unknown };

export async function runRenderer(
  value: unknown,
  emit: (event: Observation) => void,
  controller = new AbortController(),
) {
  const mode = validateMode(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const renderer = new TextRenderer(mode);
  const observations: Observation[] = [];
  const observe = (type: string, detail: unknown) => {
    const event = { type, detail };
    observations.push(event);
    emit(event);
  };
  let messageId = '';
  let deltaCount = 0;
  let completedCount = 0;
  let answer = '';
  let success = false;
  let error = '';
  let run: Query | undefined;
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    run = query({
      prompt:
        'Reply with exactly these three lines, with no extra formatting or text:\n' + expectedText,
      options: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {},
        settingSources: [],
        includePartialMessages: true,
        maxTurns: 1,
        maxBudgetUsd: 0.2,
        abortController: controller,
        systemPrompt: 'Follow the requested response format precisely.',
      },
    });
    for await (const message of run) {
      if (message.type === 'stream_event') {
        const event = message.event;
        if (event.type === 'message_start') {
          messageId = event.message.id;
          observe('message-start', { messageId });
        }
        if (event.type === 'content_block_start' && event.content_block.type === 'text')
          renderer.start(messageId, event.index, event.content_block.text);
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          deltaCount++;
          renderer.delta(messageId, event.index, event.delta.text);
          observe('delta-render', {
            messageId,
            index: event.index,
            text: event.delta.text,
            ...renderer.snapshot(),
          });
        }
      }
      if (message.type === 'assistant') {
        for (const [index, block] of message.message.content.entries()) {
          if (block.type !== 'text') continue;
          completedCount++;
          renderer.complete(message.message.id, message.uuid + ':' + index, block.text);
          observe('completed-render', {
            messageId: message.message.id,
            eventId: message.uuid,
            text: block.text,
            ...renderer.snapshot(),
          });
        }
      }
      if (message.type === 'result') {
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
        success = message.subtype === 'success' && !message.is_error;
        observe('result', {
          subtype: message.subtype,
          isError: message.is_error,
          sessionId: message.session_id,
        });
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timeout);
    run?.close();
  }
  const rendered = renderer.snapshot();
  const finalTextMatched = rendered.visibleText === rendered.completedText;
  const naiveExpected = rendered.blocks
    .map((block) => block.streamed + (block.completed ?? ''))
    .join('');
  const verified =
    success &&
    !error &&
    deltaCount > 0 &&
    completedCount > 0 &&
    answer.trim() === expectedText &&
    rendered.completedText === answer &&
    (mode === 'naive'
      ? !finalTextMatched && rendered.visibleText === naiveExpected
      : finalTextMatched);
  return {
    mode,
    ...rendered,
    expectedText,
    answer,
    deltaCount,
    completedCount,
    finalTextMatched,
    success,
    error,
    observations,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
