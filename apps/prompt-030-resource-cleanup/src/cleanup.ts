import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { ProcessTracker } from './process-tracker.js';

export function validateMode(value: unknown) {
  if (typeof value !== 'string' || !['success', 'cancel', 'exception'].includes(value))
    throw new Error('INVALID_MODE · Select success, cancel, or exception.');
  return value;
}

export async function runCleanup(value: unknown) {
  const mode = validateMode(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const tracker = new ProcessTracker();
  const controller = new AbortController();
  const events: { type: string; detail: string }[] = [];
  let run: Query | undefined;
  let sdkError = '';
  let applicationError = '';
  let answer = '';
  let partialText = '';
  let cancellationRequested = false;
  let cleanupCalled = false;
  let cleanupError = '';
  let successResult = false;
  let timeoutTriggered = false;
  const timeout = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, 90000);
  let processReport: Awaited<ReturnType<ProcessTracker['verifyStopped']>>;
  try {
    run = query({
      prompt:
        mode === 'cancel'
          ? 'Print the integers from 1 to 1000, one integer per line. Start immediately and include every integer.'
          : 'Reply with exactly 4',
      options: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {},
        settingSources: [],
        maxTurns: 1,
        maxBudgetUsd: 0.3,
        systemPrompt: 'Follow the requested text format precisely.',
        includePartialMessages: true,
        abortController: controller,
        spawnClaudeCodeProcess: tracker.spawn,
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        events.push({ type: 'initialized', detail: message.session_id });
        if (mode === 'exception')
          throw new Error('CLASSROOM_APP_EXCEPTION · Deliberate failure after SDK initialization.');
      }
      if (
        message.type === 'stream_event' &&
        message.event.type === 'content_block_delta' &&
        message.event.delta.type === 'text_delta'
      ) {
        partialText += message.event.delta.text;
        if (mode === 'cancel' && !cancellationRequested) {
          cancellationRequested = true;
          events.push({
            type: 'cancellation-requested',
            detail: 'AbortController.abort() after the first actual text delta.',
          });
          controller.abort();
        }
      }
      if (message.type === 'result') {
        events.push({ type: 'result', detail: message.subtype + ' · ' + message.terminal_reason });
        successResult = message.subtype === 'success' && !message.is_error;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.startsWith('CLASSROOM_APP_EXCEPTION')) applicationError = detail;
    else sdkError = detail;
    events.push({ type: applicationError ? 'application-exception' : 'sdk-exception', detail });
  } finally {
    cleanupCalled = true;
    clearTimeout(timeout);
    events.push({ type: 'finally', detail: 'End the query and verify the tracked subprocess.' });
    try {
      run?.close();
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : String(error);
      events.push({ type: 'query-close-error', detail: cleanupError });
    }
    processReport = await tracker.verifyStopped();
    events.push({
      type: 'pid-probe',
      detail: 'aliveAfterCleanup=' + processReport.aliveAfterCleanup,
    });
  }
  const scenarioVerified =
    mode === 'success'
      ? successResult && answer.trim() === '4'
      : mode === 'cancel'
        ? cancellationRequested && partialText.length > 0
        : applicationError.startsWith('CLASSROOM_APP_EXCEPTION');
  return {
    mode,
    answer,
    partialText,
    sdkError,
    applicationError,
    cancellationRequested,
    cleanupCalled,
    cleanupError,
    timeoutTriggered,
    events,
    process: processReport,
    verified:
      scenarioVerified &&
      cleanupCalled &&
      !cleanupError &&
      processReport.verifiedStopped &&
      !timeoutTriggered,
    checkedAt: new Date().toISOString(),
  };
}
