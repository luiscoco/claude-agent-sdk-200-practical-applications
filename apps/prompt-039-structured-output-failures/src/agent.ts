import path from 'node:path';
import { query, type Query, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { consumeCount, impossibleSchema, inspectResult, validSchema } from './results.js';

const root = path.resolve(import.meta.dirname, '..');
export const modes = ['exhausted', 'missing-output', 'turn-limit', 'repaired'];
export function prepareScenario(mode: unknown) {
  if (typeof mode !== 'string' || !modes.includes(mode))
    throw new Error('INVALID_MODE Â· Select a structured-output failure scenario.');
  const schema =
    mode === 'exhausted' ? impossibleSchema : mode === 'missing-output' ? null : validSchema;
  const prompt =
    mode === 'exhausted'
      ? 'Return a count using the StructuredOutput tool. Attempt count 1, then 0 if validation asks you to retry. Keep trying the tool until the run ends.'
      : mode === 'missing-output'
        ? 'Reply with exactly COUNT 2 as plain text.'
        : mode === 'turn-limit'
          ? 'First use Read to read ' +
            path.join(root, 'fixtures/count.txt') +
            '. Only after receiving the file content, return its count using StructuredOutput.'
          : 'Return the supplied count of 2 using the StructuredOutput tool.';
  return { mode, schema, prompt, maxTurns: mode === 'turn-limit' ? 1 : 16 };
}
export async function runFailures(value: unknown) {
  const scenario = prepareScenario(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS Â· Configure ANTHROPIC_API_KEY locally.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let run: Query | undefined;
  let nativeResult: SDKResultMessage | null = null;
  let iteratorError = '';
  let nativeVersion = '';
  const otherToolCalls: Array<{ name: string; input: unknown }> = [];
  const attempts: Array<{ id: string; input: unknown }> = [];
  const toolResults: Array<{ toolUseId: string; isError: boolean; content: unknown }> = [];
  try {
    run = query({
      prompt: scenario.prompt,
      options: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        cwd: root,
        tools: scenario.mode === 'turn-limit' ? ['Read'] : [],
        allowedTools: scenario.mode === 'turn-limit' ? ['Read'] : [],
        mcpServers: {},
        settingSources: [],
        maxTurns: scenario.maxTurns,
        maxBudgetUsd: 1,
        abortController: controller,
        systemPrompt:
          'This is a controlled structured-output handling experiment. Attempt the requested output even when validation asks for a retry.',
        ...(scenario.schema
          ? { outputFormat: { type: 'json_schema' as const, schema: scenario.schema } }
          : {}),
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init')
        nativeVersion = message.claude_code_version;
      if (message.type === 'assistant')
        for (const block of message.message.content) {
          if (block.type === 'tool_use' && block.name !== 'StructuredOutput')
            otherToolCalls.push({ name: block.name, input: block.input });
          if (block.type === 'tool_use' && block.name === 'StructuredOutput')
            attempts.push({ id: block.id, input: block.input });
        }
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (
            block.type === 'tool_result' &&
            attempts.some((attempt) => attempt.id === block.tool_use_id)
          )
            toolResults.push({
              toolUseId: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
        }
      // Save the native result before a single-shot iterator can throw afterwards.
      if (message.type === 'result') nativeResult = message;
    }
  } catch (failure) {
    iteratorError = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const outcome = inspectResult(nativeResult);
  const typedOutput =
    outcome.kind === 'ready' && !iteratorError ? consumeCount(outcome.data) : null;
  const rawOutput =
    nativeResult?.subtype === 'success' ? (nativeResult.structured_output ?? null) : null;
  const verified =
    scenario.mode === 'exhausted'
      ? outcome.kind === 'retry_exhausted' &&
        attempts.length > 1 &&
        toolResults.some((result) => result.isError) &&
        typedOutput === null
      : scenario.mode === 'missing-output'
        ? outcome.kind === 'missing_output' &&
          nativeResult?.subtype === 'success' &&
          typedOutput === null
        : scenario.mode === 'turn-limit'
          ? nativeResult?.subtype === 'error_max_turns' &&
            outcome.kind === 'native_error' &&
            typedOutput === null
          : outcome.kind === 'ready' &&
            !iteratorError &&
            typedOutput?.count === 2 &&
            typedOutput.countPlusOne === 3;
  return {
    mode: scenario.mode,
    scenario,
    nativeVersion,
    nativeResult,
    rawOutput,
    attempts,
    toolResults,
    otherToolCalls,
    outcome,
    iteratorError,
    typedOutput,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
