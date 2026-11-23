import { query, type Query } from '@anthropic-ai/claude-agent-sdk';

export const defaultPrompt =
  'Rewrite these verified facts as three short numbered paragraphs for programming students. Use about 90 words in plain text. First, includePartialMessages enables stream_event messages. A content_block_delta whose delta.type is text_delta contains new text. Second, completed assistant text blocks arrive as assistant messages and can be stored independently. Third, a result message reports the SDK turn outcome. It is a separate SDK message from the API message_stop event. Show text from deltas once and use result for final status.';
export type Observation = { type: string; elapsedMs: number; text?: string; detail?: unknown };
export function validateInput(mode: unknown, prompt: unknown) {
  if (typeof mode !== 'string' || !['incremental', 'complete', 'wrong-filter'].includes(mode))
    throw new Error('INVALID_MODE · Choose an available streaming mode.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > 2000)
    throw new Error('INVALID_PROMPT · Enter between 1 and 2000 characters.');
  return { mode, prompt: prompt.trim() };
}

export async function runTextStream(
  modeValue: unknown,
  promptValue: unknown,
  emit: (event: Observation) => void,
  controller = new AbortController(),
) {
  const { mode, prompt } = validateInput(modeValue, promptValue);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const started = performance.now();
  const events: Observation[] = [];
  const observe = (type: string, text?: string, detail?: unknown) => {
    const event = { type, elapsedMs: Math.round(performance.now() - started), text, detail };
    events.push(event);
    emit(event);
  };
  let deltaCount = 0;
  let renderedDeltaCount = 0;
  let streamedText = '';
  let completedText = '';
  let renderedText = '';
  let answer = '';
  let success = false;
  let error = '';
  let sessionId = '';
  let run: Query | undefined;
  const acceptedDeltaType = mode === 'wrong-filter' ? 'input_json_delta' : 'text_delta';
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    run = query({
      prompt,
      options: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {},
        settingSources: [],
        maxTurns: 1,
        maxBudgetUsd: 0.3,
        includePartialMessages: mode !== 'complete',
        abortController: controller,
        systemPrompt:
          'Provide accurate, concise educational explanations. Follow the requested format.',
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        sessionId = message.session_id;
        observe('initialized', undefined, { sessionId });
      }
      if (
        message.type === 'stream_event' &&
        message.event.type === 'content_block_delta' &&
        message.event.delta.type === 'text_delta'
      ) {
        deltaCount++;
        streamedText += message.event.delta.text;
        observe('observed-text-delta', undefined, { length: message.event.delta.text.length });
        // This deliberate classroom filter discards text events in wrong-filter mode.
        if (message.event.delta.type === acceptedDeltaType) {
          renderedDeltaCount++;
          renderedText += message.event.delta.text;
          observe('render-text', message.event.delta.text);
        }
      }
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type !== 'text') continue;
          completedText += block.text;
          observe('completed-block', undefined, { length: block.text.length });
          if (mode === 'complete') {
            renderedText += block.text;
            observe('render-text', block.text);
          }
        }
      }
      if (message.type === 'result') {
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
        success = message.subtype === 'success' && !message.is_error;
        observe('result', undefined, { subtype: message.subtype, isError: message.is_error });
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
    observe('sdk-error', undefined, error);
  } finally {
    clearTimeout(timeout);
    run?.close();
  }
  const finalTextMatched = success && completedText === answer;
  const verified =
    !error &&
    finalTextMatched &&
    (mode === 'wrong-filter'
      ? deltaCount > 0 && renderedDeltaCount === 0 && renderedText === ''
      : renderedText === answer && (mode === 'complete' || renderedDeltaCount > 0));
  return {
    mode,
    acceptedDeltaType,
    prompt,
    deltaCount,
    renderedDeltaCount,
    streamedText,
    completedText,
    renderedText,
    answer,
    finalTextMatched,
    sessionId,
    success,
    error,
    events,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
