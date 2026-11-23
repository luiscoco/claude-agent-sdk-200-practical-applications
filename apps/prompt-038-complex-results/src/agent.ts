import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { boundaryCandidate, consumePlan, CoursePlanSchema, jsonSchema } from './schema.js';
import { preparePlan } from './task.js';

export async function runComplex(value: unknown) {
  const task = preparePlan(value);
  const mode = task.mode;
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
        'Extract the supplied course plan into the requested nested structure. Preserve exact titles, lesson order and tag order. Omit optional timezone and notes fields when the corresponding facts are absent.\n\n' +
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
        systemPrompt:
          'Use only the supplied course plan facts. Omit optional fields whose facts were not supplied.',
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
  const candidate = boundaryCandidate(rawOutput, mode);
  const parsed = CoursePlanSchema.safeParse(candidate);
  const typedOutput = success && !error && parsed.success ? consumePlan(parsed.data) : null;
  const issues = parsed.success ? [] : parsed.error.issues;
  const rawFactsMatched = isDeepStrictEqual(rawOutput, task.expected);
  const failurePath = mode === 'missing-name' ? 'owner.name' : 'audience';
  const deliberateFailure = mode === 'missing-name' || mode === 'invalid-enum';
  const scenarioMatched = deliberateFailure
    ? !parsed.success &&
      typedOutput === null &&
      issues.some((issue) => issue.path.join('.') === failurePath)
    : parsed.success &&
      isDeepStrictEqual(parsed.data, task.expected) &&
      typedOutput?.totalMinutes === 35;
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
    rawFactsMatched,
    success,
    answer,
    error,
    sessionId,
    verified: success && !error && rawFactsMatched && scenarioMatched,
    checkedAt: new Date().toISOString(),
  };
}
