import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { isDeepStrictEqual } from 'node:util';
import { InvoiceSchema, jsonSchema } from './schema.js';
import { consumeInvoice, validateBusiness } from './business.js';
import { prepareInvoice } from './task.js';
export async function runBusiness(value: unknown) {
  const task = prepareInvoice(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let rawOutput: unknown = null;
  let success = false;
  let error = '';
  let sessionId = '';
  try {
    run = query({
      prompt: task.sourceText,
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
          'You are an exact invoice extraction service. Preserve supplied values, item order and amounts. Application code performs the subsequent factual and business checks.',
      },
    });
    for await (const message of run) {
      if (message.type !== 'result') continue;
      success = message.subtype === 'success' && !message.is_error;
      rawOutput = message.subtype === 'success' ? (message.structured_output ?? null) : null;
      sessionId = message.session_id;
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const parsed = InvoiceSchema.safeParse(rawOutput);
  const business = success && !error && parsed.success ? validateBusiness(parsed.data) : null;
  const typedOutput = parsed.success && business?.passed ? consumeInvoice(parsed.data) : null;
  const suppliedValuesPreserved = isDeepStrictEqual(rawOutput, task.supplied);
  const expectedPath = task.mode === 'wrong-price' ? 'items.0.unitPriceCents' : 'totalCents';
  const scenarioMatched =
    task.mode === 'correct'
      ? business?.passed && typedOutput?.approvedTotalCents === 4000
      : business?.passed === false &&
        business.failures.some((item) => item.path === expectedPath) &&
        typedOutput === null;
  return {
    mode: task.mode,
    task,
    jsonSchema,
    rawOutput,
    success,
    error,
    sessionId,
    schemaPassed: parsed.success,
    schemaIssues: parsed.success ? [] : parsed.error.issues,
    business,
    typedOutput,
    suppliedValuesPreserved,
    verified:
      success && !error && parsed.success && suppliedValuesPreserved && Boolean(scenarioMatched),
    checkedAt: new Date().toISOString(),
  };
}
