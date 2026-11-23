import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import {
  query,
  type Query,
  type SDKControlGetContextUsageResponse,
} from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  searchSetting,
  outputSchema,
  decodedNative,
  toolContextMetrics,
} from './search.js';
import { publicReport } from './privacy.js';

async function eventsFrom(file: string) {
  const text = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return text.trim()
    ? text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : [];
}
export async function runSearch(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/search-'));
  const coreAudit = path.join(workspace, 'core-audit.jsonl'),
    catalogAudit = path.join(workspace, 'catalog-audit.jsonl');
  const setting = searchSetting(requestedInput.mode);
  const coreTool = 'mcp__core__health';
  const targetTool = 'mcp__catalog__lesson_' + String(requestedInput.lessonId).padStart(2, '0');
  const expectedInputs: Record<string, unknown> = {
    [coreTool]: {},
    [targetTool]: { lessonId: requestedInput.lessonId },
  };
  const calls: Array<{ id: string; name: string; input: unknown; atMs: number }> = [];
  const decisions: Array<{ id: string; name: string; allowed: boolean }> = [];
  const results: Array<{
    id: string;
    name: string;
    isError: boolean;
    content: unknown;
    metadata: unknown;
  }> = [];
  const seen = new Set<string>();
  let releaseTask: () => void = () => {},
    releaseInput: () => void = () => {};
  const taskGate = new Promise<void>((resolve) => {
    releaseTask = resolve;
  });
  const inputGate = new Promise<void>((resolve) => {
    releaseInput = resolve;
  });
  let closing = false,
    taskSubmitted = false;
  async function* input() {
    await taskGate;
    if (closing) return;
    taskSubmitted = true;
    yield {
      type: 'user' as const,
      session_id: '',
      parent_tool_use_id: null,
      message: {
        role: 'user' as const,
        content: `Call ${coreTool} once with {}. Then find the classroom catalog tool for lesson ${requestedInput.lessonId} and call it once with {"lessonId":${requestedInput.lessonId}}. Use ToolSearch if its definition needs discovery. Return ready from the core result and copy the actual lessonId, title and minutes from the catalog result. Do not call another lesson tool or retry.`,
      },
    };
    await inputGate;
  }
  let contextBefore: SDKControlGetContextUsageResponse | undefined,
    contextAfter: SDKControlGetContextUsageResponse | undefined;
  let nativeServerStatus: Awaited<ReturnType<Query['mcpServerStatus']>> = [];
  let rawOutput: unknown, modelUsage: unknown;
  let success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  let nativeDurationMs: number | null = null,
    nativeApiDurationMs: number | null = null,
    taskElapsedMs: number | null = null;
  let contextProbeMs = 0,
    taskStarted = 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240000);
  const started = Date.now();
  const run = query({
    prompt: input(),
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: ['ToolSearch'],
      mcpServers: {
        core: {
          type: 'stdio',
          command: process.execPath,
          args: [path.join(root, 'src/mcp-server.mjs'), 'core', coreAudit],
          alwaysLoad: true,
        },
        catalog: {
          type: 'stdio',
          command: process.execPath,
          args: [path.join(root, 'src/mcp-server.mjs'), 'catalog', catalogAudit],
          alwaysLoad: false,
        },
      },
      allowedTools: ['ToolSearch', coreTool, 'mcp__catalog__*'],
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
        ENABLE_TOOL_SEARCH: setting,
        MCP_TIMEOUT: '60000',
        MCP_CONNECTION_NONBLOCKING: '0',
        MCP_CONNECT_TIMEOUT_MS: '60000',
        CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
      },
      maxTurns: 8,
      maxBudgetUsd: 1.5,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'mcp__.*',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const allowed =
                  Object.hasOwn(expectedInputs, input.tool_name) &&
                  !seen.has(input.tool_name) &&
                  isDeepStrictEqual(input.tool_input, expectedInputs[input.tool_name]);
                decisions.push({ id: input.tool_use_id, name: input.tool_name, allowed });
                if (allowed) seen.add(input.tool_name);
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: allowed ? 'allow' : 'deny',
                  },
                };
              },
            ],
          },
        ],
      },
    },
  });
  const reader = (async () => {
    try {
      for await (const message of run) {
        if (message.type === 'assistant')
          for (const block of message.message.content)
            if (block.type === 'tool_use')
              calls.push({
                id: block.id,
                name: block.name,
                input: block.input,
                atMs: Date.now() - started,
              });
        if (message.type === 'user' && Array.isArray(message.message.content))
          for (const block of message.message.content) {
            if (block.type !== 'tool_result') continue;
            const call = calls.find((call) => call.id === block.tool_use_id);
            if (call)
              results.push({
                id: call.id,
                name: call.name,
                isError: Boolean(block.is_error),
                content: block.content,
                metadata: message.tool_use_result ?? null,
              });
          }
        if (message.type === 'result') {
          taskElapsedMs = Date.now() - taskStarted;
          success = message.subtype === 'success' && !message.is_error;
          sessionId = message.session_id;
          resultStatus = message.subtype;
          nativeDurationMs = message.duration_ms;
          nativeApiDurationMs = message.duration_api_ms;
          modelUsage = message.modelUsage;
          if (message.subtype === 'success') rawOutput = message.structured_output;
          const probeStarted = Date.now();
          contextAfter = await run.getContextUsage({ detail: 'full' });
          contextProbeMs += Date.now() - probeStarted;
          break;
        }
      }
    } catch (failure) {
      if (!closing) error = failure instanceof Error ? failure.message : String(failure);
    }
  })();
  try {
    const connectStarted = Date.now();
    do {
      nativeServerStatus = await run.mcpServerStatus();
      if (
        ['core', 'catalog'].every((name) =>
          nativeServerStatus.some(
            (server) => server.name === name && server.status === 'connected',
          ),
        )
      )
        break;
      await delay(250);
    } while (Date.now() - connectStarted < 60000);
    const probeStarted = Date.now();
    contextBefore = await run.getContextUsage({ detail: 'full' });
    contextProbeMs += Date.now() - probeStarted;
    taskStarted = Date.now();
    releaseTask();
    await reader;
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    closing = true;
    run.close();
    releaseTask();
    releaseInput();
    await reader;
  }
  const coreEvents = await eventsFrom(coreAudit),
    catalogEvents = await eventsFrom(catalogAudit);
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const admittedResults = results.filter((result) =>
    decisions.some((decision) => decision.id === result.id && decision.allowed),
  );
  const coreBefore = contextBefore?.mcpTools.find((tool) => tool.name === coreTool);
  const searchCalls = calls.filter((call) => call.name === 'ToolSearch');
  const low = requestedInput.mode === 'low-threshold';
  const beforeMetrics = contextBefore ? toolContextMetrics(contextBefore) : null;
  const afterMetrics = contextAfter ? toolContextMetrics(contextAfter) : null;
  const checks = {
    serversConnected: ['core', 'catalog'].every((name) =>
      nativeServerStatus.some((server) => server.name === name && server.status === 'connected'),
    ),
    fullContextSnapshotsCaptured: Boolean(contextBefore && contextAfter),
    coreLoadedBeforeTask: coreBefore?.isLoaded === true,
    catalogLoadingMatches: Boolean(
      beforeMetrics &&
      beforeMetrics.catalogDefinitionCount === 48 &&
      (low
        ? beforeMetrics.deferredMcpTokens > 0 &&
          beforeMetrics.usedMcpTokens < beforeMetrics.deferredMcpTokens
        : beforeMetrics.deferredMcpTokens === 0 &&
          beforeMetrics.usedMcpTokens > (coreBefore?.tokens ?? 0)),
    ),
    nativeSearchMatches: low ? searchCalls.length > 0 : searchCalls.length === 0,
    contextAfterMatches: Boolean(
      beforeMetrics &&
      afterMetrics &&
      (low
        ? afterMetrics.usedMcpTokens > beforeMetrics.usedMcpTokens &&
          afterMetrics.deferredMcpTokens < beforeMetrics.deferredMcpTokens
        : afterMetrics.usedMcpTokens === beforeMetrics.usedMcpTokens &&
          afterMetrics.deferredMcpTokens === 0),
    ),
    actualCoreHandler: coreEvents.length === 1 && coreEvents[0].outcome.ready === true,
    actualRequestedCatalogHandler:
      catalogEvents.length === 1 &&
      isDeepStrictEqual(catalogEvents[0].input, { lessonId: requestedInput.lessonId }),
    nativeHandlerResultsMatch: [...coreEvents, ...catalogEvents].every((event) =>
      admittedResults.some(
        (result) =>
          !result.isError && isDeepStrictEqual(decodedNative(result.content), event.outcome),
      ),
    ),
    finalMatches: isDeepStrictEqual(output, {
      ready: true,
      lessonId: requestedInput.lessonId,
      title: 'Classroom lesson ' + String(requestedInput.lessonId).padStart(2, '0'),
      minutes: 5 + (requestedInput.lessonId % 6),
    }),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      searchSetting: setting,
      catalogToolCount: 48,
      coreAlwaysLoad: true,
      taskSubmitted,
      nativeServerStatus,
      contextBefore,
      contextAfter,
      beforeMetrics,
      afterMetrics,
      measurements: {
        nativeDurationMs,
        nativeApiDurationMs,
        taskElapsedMs,
        contextProbeMs,
        instrumentedTotalMs: Date.now() - started,
      },
      modelUsage,
      calls,
      decisions,
      results,
      coreEvents,
      catalogEvents,
      output,
      checks,
      success,
      sessionId,
      resultStatus,
      error,
      verified: !error && success && Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
