import path from 'node:path';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import {
  SearchSchema,
  jsonSchema,
  prepareSearch,
  projectSnapshot,
  verifySearch,
  normalizeSearch,
  searchOutcome,
} from './search.js';
const root = path.resolve(import.meta.dirname, '..');
const project = path.join(root, 'fixtures/project');
export async function runSearch(value: unknown) {
  const task = prepareSearch(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{ toolUseId: string; isError: boolean; content: unknown }> = [];
  let rawOutput: unknown = null;
  let success = false;
  let error = '';
  let sessionId = '';
  let availableTools: string[] = [];
  try {
    run = query({
      prompt: [
        'Use Glob with pattern ' +
          JSON.stringify(task.glob) +
          ' and path ' +
          JSON.stringify(project) +
          '.',
        'Then use Grep with pattern ' + JSON.stringify(task.pattern) + ' and the same path.',
        'Set output_mode to "content" and the ASCII property "-n" to true for line numbers.',
        'Return all discovered TypeScript paths relative to the project root.',
        'Return every matching source line with project-relative file, exact line number and copied code.',
        'Keep the summary short. An empty search returns empty matches and an empty error string.',
        task.mode === 'invalid-regex'
          ? 'Use this malformed regex once. Preserve its actual tool error, return empty matches and stop.'
          : 'If a parameter-name validation error occurs, correct the argument key and retry the same regex once.',
      ].join('\n'),
      options: {
        cwd: root,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Glob', 'Grep'],
        allowedTools: ['Glob', 'Grep'],
        mcpServers: {},
        settingSources: [],
        maxTurns: 6,
        maxBudgetUsd: 0.75,
        abortController: controller,
        outputFormat: { type: 'json_schema', schema: jsonSchema },
        systemPrompt:
          'Use the requested native file-finding and content-search tools. Preserve exact observed paths, line numbers, code and errors in the structured result.',
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') availableTools = message.tools;
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use' && ['Glob', 'Grep'].includes(block.name))
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
  const snapshot = await projectSnapshot(project, task.pattern);
  const parsed = SearchSchema.safeParse(rawOutput);
  const comparison = parsed.success
    ? verifySearch(parsed.data, snapshot, project)
    : { filesMatched: false, matchesMatched: false };
  const grepCalls = calls.filter((call) => call.name === 'Grep');
  const exactPattern = grepCalls.some(
    (call) =>
      call.input &&
      typeof call.input === 'object' &&
      'pattern' in call.input &&
      call.input.pattern === task.pattern,
  );
  const { searchCompleted, searchFailed, hadSearchError } = searchOutcome(calls, toolResults);
  const scenarioMatched =
    task.mode === 'invalid-regex'
      ? searchFailed &&
        parsed.success &&
        Boolean(parsed.data.error) &&
        parsed.data.matches.length === 0
      : !searchFailed && parsed.success && !parsed.data.error && comparison.matchesMatched;
  return {
    task,
    project,
    snapshot,
    availableTools,
    calls,
    toolResults,
    rawOutput,
    parsedData: parsed.success ? parsed.data : null,
    normalizedData: parsed.success ? normalizeSearch(parsed.data, project) : null,
    schemaPassed: parsed.success,
    comparison,
    exactPattern,
    searchFailed,
    searchCompleted,
    hadSearchError,
    success,
    error,
    sessionId,
    verified:
      success &&
      !error &&
      parsed.success &&
      comparison.filesMatched &&
      exactPattern &&
      searchCompleted &&
      calls.some((call) => call.name === 'Glob') &&
      Boolean(scenarioMatched),
    checkedAt: new Date().toISOString(),
  };
}
