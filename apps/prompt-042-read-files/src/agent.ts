import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { SourceSummarySchema, jsonSchema, validateSections } from './schema.js';
import { classroomExample } from '../fixtures/checkout.js';
const root = path.resolve(import.meta.dirname, '..');
export function prepareRead(mode: unknown, topic: unknown) {
  if (mode !== 'existing' && mode !== 'missing')
    throw new Error('INVALID_MODE · Select the existing or missing source path.');
  if (topic !== 'total' && topic !== 'discount')
    throw new Error('INVALID_TOPIC · Select total calculation or discount validation.');
  const file = path.join(
    root,
    'fixtures',
    mode === 'missing' ? 'missing-checkout.ts' : 'checkout.ts',
  );
  const expectedFunction = topic === 'total' ? 'calculateTotal' : 'validateDiscount';
  const question =
    topic === 'total'
      ? 'Summarize how calculateTotal computes and validates the invoice total, including its classroom example.'
      : 'Summarize the validateDiscount rules, including the 500-cent policy and subtotal condition.';
  return { mode, topic, file, expectedFunction, question };
}
export async function readSource(mode: unknown, topic: unknown) {
  const task = prepareRead(mode, topic);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let rawOutput: unknown = null;
  let success = false;
  let error = '';
  let sessionId = '';
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{ toolUseId: string; isError: boolean; content: unknown }> = [];
  try {
    run = query({
      prompt: [
        'First use Read directly on ' + task.file + '.',
        task.question,
        'Return a summary of at most 80 words, including READ-042 after a successful read.',
        'Return at most three relevant function sections with exact source line ranges.',
        'Put the section covering ' + task.expectedFunction + ' first and include its declaration.',
        'Keep each section explanation to at most 20 words.',
        'Read only this requested path. If Read fails, copy its actual error to readError and return empty sections.',
      ].join('\n'),
      options: {
        cwd: root,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Read'],
        allowedTools: ['Read'],
        mcpServers: {},
        settingSources: [],
        maxTurns: 6,
        maxBudgetUsd: 0.75,
        abortController: controller,
        outputFormat: { type: 'json_schema', schema: jsonSchema },
        systemPrompt:
          'Use the native Read tool before answering. Base summaries and line ranges on its actual returned source. Classroom amounts are euro cents (EUR). Preserve those source units. Do not attempt alternate paths after a read error.',
      },
    });
    for await (const message of run) {
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use' && block.name === 'Read')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content)
          if (block.type === 'tool_result' && calls.some((call) => call.id === block.tool_use_id))
            toolResults.push({
              toolUseId: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        rawOutput = message.subtype === 'success' ? (message.structured_output ?? null) : null;
        sessionId = message.session_id;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const parsed = SourceSummarySchema.safeParse(rawOutput);
  const source = await readFile(path.join(root, 'fixtures/checkout.ts'), 'utf8');
  const sourceLines = source.split(/\r?\n/);
  const pathMatched = calls.some(
    (call) =>
      call.input &&
      typeof call.input === 'object' &&
      'file_path' in call.input &&
      typeof call.input.file_path === 'string' &&
      path.resolve(call.input.file_path) === task.file,
  );
  const readFailed = toolResults.some((result) => result.isError);
  const sectionsVerified =
    parsed.success && validateSections(parsed.data.sections, sourceLines, task.expectedFunction);
  const dollarNotationAbsent =
    parsed.success && !/\$|\b(?:USD|dollars?)\b/i.test(JSON.stringify(parsed.data));
  const scenarioMatched =
    task.mode === 'missing'
      ? readFailed &&
        parsed.success &&
        parsed.data.sections.length === 0 &&
        Boolean(parsed.data.readError)
      : !readFailed &&
        sectionsVerified &&
        parsed.success &&
        !parsed.data.readError &&
        parsed.data.summary.includes('READ-042');
  return {
    task,
    sourceFile: 'fixtures/checkout.ts',
    sourceLines,
    jsonSchema,
    rawOutput,
    parsedData: parsed.success ? parsed.data : null,
    schemaPassed: parsed.success,
    calls,
    toolResults,
    pathMatched,
    readFailed,
    sectionsVerified,
    dollarNotationAbsent,
    classroomExample,
    success,
    error,
    sessionId,
    verified: success && !error && pathMatched && dollarNotationAbsent && Boolean(scenarioMatched),
    checkedAt: new Date().toISOString(),
  };
}
