import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { consumeWorkshop, corruptDuration, jsonSchema, WorkshopSchema } from './schema.js';
import { prepareTask } from './task.js';

export async function runZod(mode: unknown, taskName: unknown) {
  if (mode !== 'valid' && mode !== 'corrupt-boundary')
    throw new Error('INVALID_MODE · Select valid or corrupt-boundary.');
  const task = prepareTask(taskName);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let rawOutput: unknown = null;
  let success = false;
  let error = '';
  let answer = '';
  let sessionId = '';
  try {
    run = query({
      prompt:
        'Extract the supplied workshop facts. Preserve exact title and prerequisite order.\n' +
        task.sourceText,
      options: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {},
        settingSources: [],
        maxTurns: 4,
        maxBudgetUsd: 0.5,
        abortController: controller,
        outputFormat: { type: 'json_schema', schema: jsonSchema },
        systemPrompt: 'Return the supplied workshop facts through the requested structured output.',
      },
    });
    for await (const message of run) {
      if (message.type !== 'result') continue;
      rawOutput = message.subtype === 'success' ? (message.structured_output ?? null) : null;
      success = message.subtype === 'success' && !message.is_error;
      answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
      sessionId = message.session_id;
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timeout);
    run?.close();
  }
  const candidate = mode === 'corrupt-boundary' ? corruptDuration(rawOutput) : rawOutput;
  const parsed = WorkshopSchema.safeParse(candidate);
  let typedOutput: ReturnType<typeof consumeWorkshop> | null = null;
  if (success && !error && parsed.success) typedOutput = consumeWorkshop(parsed.data);
  const issues = parsed.success ? [] : parsed.error.issues;
  const rawFactsMatched = isDeepStrictEqual(rawOutput, task.expected);
  const scenarioMatched =
    mode === 'corrupt-boundary'
      ? !parsed.success &&
        typedOutput === null &&
        issues.some(
          (issue) => issue.code === 'invalid_type' && issue.path.join('.') === 'durationMinutes',
        )
      : parsed.success &&
        isDeepStrictEqual(parsed.data, task.expected) &&
        typedOutput?.totalMinutesWithBreak === task.expected.durationMinutes + 5;
  return {
    mode,
    task,
    jsonSchema,
    rawOutput,
    candidate,
    parsedData: parsed.success ? parsed.data : null,
    validationPassed: parsed.success,
    issues,
    typedOutput,
    typedConsumerCalled: typedOutput !== null,
    rawFactsMatched,
    success,
    answer,
    error,
    sessionId,
    verified: success && !error && rawFactsMatched && scenarioMatched,
    checkedAt: new Date().toISOString(),
  };
}
