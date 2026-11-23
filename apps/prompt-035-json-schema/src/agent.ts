import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { prepareTask, selectSchema } from './schema.js';

export async function runSchema(mode: unknown, taskName: unknown) {
  const schema = selectSchema(mode);
  const task = prepareTask(taskName);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  const events: { type: string; subtype?: string }[] = [];
  const toolNames: string[] = [];
  let structuredOutput: unknown = null;
  let answer = '';
  let success = false;
  let sdkError = '';
  let diagnostics = '';
  let sessionId = '';
  let run: Query | undefined;
  try {
    run = query({
      prompt:
        'Extract the workshop data from these supplied facts. Preserve prerequisite order and exact title. Return the structured result requested by the output format.\n\n' +
        task.sourceText,
      options: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {},
        settingSources: [],
        maxTurns: 4,
        maxBudgetUsd: 0.5,
        abortController: controller,
        outputFormat: { type: 'json_schema', schema },
        systemPrompt:
          'Extract only the supplied workshop facts into the requested structured result.',
        stderr: (text) => {
          diagnostics = (diagnostics + text).slice(-4000);
        },
      },
    });
    for await (const message of run) {
      events.push({
        type: message.type,
        ...('subtype' in message ? { subtype: message.subtype } : {}),
      });
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use') toolNames.push(block.name);
      if (message.type === 'result') {
        structuredOutput =
          message.subtype === 'success' ? (message.structured_output ?? null) : null;
        success = message.subtype === 'success' && !message.is_error;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
        sessionId = message.session_id;
      }
    }
  } catch (error) {
    sdkError = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timeout);
    run?.close();
  }
  const factsMatched = isDeepStrictEqual(structuredOutput, task.expected);
  const nativeSchemaError =
    !success &&
    Boolean(sdkError || answer) &&
    /not a valid JSON Schema: data\/required must be array/i.test(sdkError + answer + diagnostics);
  return {
    mode,
    task,
    schema,
    structuredOutput,
    answer,
    success,
    sdkError,
    diagnostics,
    sessionId,
    events,
    toolNames,
    factsMatched,
    verified:
      mode === 'invalid-schema'
        ? nativeSchemaError && structuredOutput === null
        : success && !sdkError && factsMatched,
    checkedAt: new Date().toISOString(),
  };
}
