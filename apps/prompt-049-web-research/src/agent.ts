import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import {
  sourceDomains,
  validatedQuestion,
  researchSchema,
  actualSearch,
  verifyFindings,
} from './research.js';
export async function researchWeb(mode: unknown, question: unknown) {
  if (mode !== 'search' && mode !== 'blocked')
    throw new Error('INVALID_MODE · Select allowed or deliberately blocked search.');
  const searchQuery = validatedQuestion(question);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/research-'));
  const permitted = (name: string, input: Record<string, unknown>) =>
    mode === 'search' &&
    name === 'WebSearch' &&
    input.query === searchQuery &&
    JSON.stringify(input.allowed_domains) === JSON.stringify(sourceDomains);
  const searches: ReturnType<typeof actualSearch>[] = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    toolUseId: string;
    name: string;
    isError: boolean;
    content?: unknown;
    contentCharacters: number;
    contentSha256: string;
  }> = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let run: Query | undefined;
  let success = false;
  let rawOutput: unknown;
  let answer = '';
  let sessionId = '';
  let error = '';
  let initialTools: string[] = [];
  try {
    run = query({
      prompt: [
        'Use native WebSearch once with exactly query ' +
          JSON.stringify(searchQuery) +
          ' and allowed_domains ' +
          JSON.stringify(sourceDomains) +
          '.',
        'Return at most three brief findings and use exact source URLs that appeared in the actual search hits. Each finding must cite its observed supporting source URL.',
        mode === 'blocked'
          ? 'This is a deliberate access-denial test. Attempt the search, preserve the actual denial and stop. Return empty findings with a brief note explaining the observed access outcome.'
          : 'Use the actual search results to form the findings. Preserve a brief note about the observed search outcome. If search produces no sources, return empty findings.',
      ].join('\n'),
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['WebSearch'],
        settingSources: [],
        mcpServers: {},
        maxTurns: 6,
        maxBudgetUsd: 0.75,
        abortController: controller,
        outputFormat: { type: 'json_schema', schema: researchSchema },
        systemPrompt:
          'Research the supplied question through the requested native WebSearch call. Base findings on its actual results and cite exact returned URLs. Keep each summary concise. A denied search produces empty findings and an observed-outcome note.',
        canUseTool: async (name, input) =>
          permitted(name, input)
            ? { behavior: 'allow', updatedInput: input }
            : {
                behavior: 'deny',
                message:
                  mode === 'blocked'
                    ? 'CLASSROOM_SEARCH_BLOCKED · Search access is deliberately withheld for this experiment.'
                    : 'Use the exact supplied search query and approved domain list.',
              },
        hooks: {
          PreToolUse: [
            {
              matcher: 'WebSearch',
              hooks: [
                async (input) =>
                  input.hook_event_name === 'PreToolUse'
                    ? {
                        hookSpecificOutput: {
                          hookEventName: 'PreToolUse',
                          permissionDecision: permitted(
                            input.tool_name,
                            input.tool_input as Record<string, unknown>,
                          )
                            ? 'allow'
                            : 'deny',
                          permissionDecisionReason:
                            mode === 'blocked'
                              ? 'CLASSROOM_SEARCH_BLOCKED · Search access is deliberately withheld for this experiment.'
                              : 'Use the exact supplied search query and approved domains.',
                        },
                      }
                    : {},
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'WebSearch',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse')
                    searches.push(actualSearch(input.tool_response));
                  return {};
                },
              ],
            },
          ],
        },
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') initialTools = message.tools;
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = calls.find((call) => call.id === block.tool_use_id);
          if (!call || call.name !== 'WebSearch') continue;
          const content =
            typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
          toolResults.push({
            toolUseId: block.tool_use_id,
            name: call.name,
            isError: Boolean(block.is_error),
            ...(block.is_error ? { content: block.content } : {}),
            contentCharacters: content.length,
            contentSha256: createHash('sha256').update(content).digest('hex'),
          });
        }
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        rawOutput = message.subtype === 'success' ? message.structured_output : undefined;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
        sessionId = message.session_id;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const hits = searches.flatMap((search) => search.hits);
  const validation = verifyFindings(rawOutput, hits);
  const nativeSearchDenied = toolResults.some(
    (result) =>
      result.isError && JSON.stringify(result.content).includes('CLASSROOM_SEARCH_BLOCKED'),
  );
  const actualSearchAttempted = calls.some((call) => call.name === 'WebSearch');
  const trustedFindings = success && validation.valid && hits.length > 0 ? validation.findings : [];
  const verified =
    !error &&
    actualSearchAttempted &&
    success &&
    validation.valid &&
    (mode === 'search'
      ? searches.length > 0 && trustedFindings.length > 0
      : nativeSearchDenied && searches.length === 0 && validation.findings.length === 0);
  return {
    mode,
    searchQuery,
    sourceDomains,
    workspace,
    searches,
    hits,
    calls,
    initialTools,
    toolResults,
    rawOutput: rawOutput ?? null,
    validation,
    trustedFindings,
    nativeSearchDenied,
    actualSearchAttempted,
    success,
    answer,
    error,
    sessionId,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
