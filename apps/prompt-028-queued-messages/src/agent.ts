import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { MessageQueue } from './queue.js';
import {
  prepareItems,
  validateItems,
  verifyAnswers,
  verifyOrder,
  type QueueResult,
} from './items.js';

export async function runQueue(mode: unknown) {
  if (typeof mode !== 'string' || !['rapid', 'paced', 'duplicate'].includes(mode))
    throw new Error('INVALID_MODE · Select rapid, paced, or duplicate.');
  const items = prepareItems(mode === 'duplicate');
  const input = new MessageQueue();
  const submittedIds: string[] = [];
  const yieldedIds: string[] = [];
  const results: QueueResult[] = [];
  let run: Query | undefined;
  let error = '';
  let model = '';
  let next = 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  function submitNext() {
    const item = items[next++];
    input.push({
      type: 'user',
      uuid: item.id,
      origin: { kind: 'human' },
      message: { role: 'user', content: item.prompt },
      parent_tool_use_id: null,
    });
    submittedIds.push(item.id);
  }
  async function* streamInput() {
    for await (const message of input.messages()) {
      yieldedIds.push(message.uuid!);
      yield message;
    }
  }
  try {
    validateItems(items);
    if (!process.env.ANTHROPIC_API_KEY?.trim())
      throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
    submitNext();
    if (mode === 'rapid') {
      while (next < items.length) submitNext();
      input.end();
    }
    run = query({
      prompt: streamInput(),
      options: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {},
        settingSources: [],
        systemPrompt:
          'For every queue item received in the current turn, calculate its answer. Output each current item as KEY=integer on its own line, preserving input order. Include all items received together in the current turn.',
        maxTurns: 4,
        maxBudgetUsd: 0.5,
        abortController: controller,
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') model = message.model;
      if (message.type !== 'result') continue;
      results.push({
        sequence: results.length + 1,
        coveredIds: message.user_message_uuids?.length
          ? message.user_message_uuids
          : message.user_message_uuid
            ? [message.user_message_uuid]
            : [],
        answer: message.subtype === 'success' ? message.result : message.errors.join(' '),
        subtype: message.subtype,
        isError: message.is_error,
        sessionId: message.session_id,
      });
      if (mode === 'paced') {
        if (next < items.length) submitNext();
        else input.end();
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timeout);
    input.end();
    run?.close();
  }
  const orderVerified = verifyOrder(items, yieldedIds, results);
  const answersVerified = results.length > 0 && verifyAnswers(items, results);
  const verified =
    mode === 'duplicate'
      ? error.startsWith('DUPLICATE_MESSAGE_ID') && submittedIds.length === 0
      : !error &&
        orderVerified &&
        answersVerified &&
        new Set(results.map((result) => result.sessionId)).size === 1;
  return {
    mode,
    items,
    submittedIds,
    yieldedIds,
    results,
    error,
    model,
    orderVerified,
    answersVerified,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
