import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { contextView, usageSchema } from './context-view.js';

async function collect(
  prompt: string | AsyncIterable<SDKUserMessage>,
  workspace: string,
  nativeConfigDirectory: string,
  resume?: string,
) {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONFIG_DIR: nativeConfigDirectory };
  delete env.CLAUDE_CODE_SKIP_PROMPT_HISTORY;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 45000);
  const events: Array<Record<string, any>> = [];
  let error = '';
  const run = query({
    prompt,
    options: {
      cwd: workspace,
      model: 'claude-sonnet-4-6',
      tools: [],
      settingSources: [],
      strictMcpConfig: true,
      persistSession: true,
      ...(resume ? { resume } : {}),
      env,
      abortController: controller,
    },
  });
  try {
    for await (const message of run) events.push(message);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run.close();
  }
  const init = events.find((message) => message.type === 'system' && message.subtype === 'init'),
    result = events.find((message) => message.type === 'result');
  return {
    actualSessionId: init?.session_id,
    actualResultSessionId: result?.session_id,
    nativeVersion: init?.claude_code_version,
    success: result?.subtype === 'success' && !result?.is_error,
    turns: result?.num_turns,
    costUsd: result?.total_cost_usd,
    durationApiMs: result?.duration_api_ms,
    resultText: result?.result,
    events,
    error,
  };
}
export async function measureContext(profile: 'baseline' | 'short' | 'long', topic: string) {
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/context-')),
    nativeConfigDirectory = path.join(workspace, 'native-config');
  const rows = profile === 'baseline' ? 0 : profile === 'short' ? 12 : 160;
  const marker = 'OWNED_CONTEXT_' + randomBytes(4).toString('hex').toUpperCase();
  const contextText = rows
    ? `Owned synthetic ${topic} classroom dataset ${marker}.\n` +
      Array.from(
        { length: rows },
        (_value, index) =>
          `Record ${index}: Keep measured conversation messages distinct from tools, project instructions, reserved context capacity and provider billing counts.`,
      ).join('\n')
    : '';
  let seeded: Awaited<ReturnType<typeof collect>> | null = null;
  if (rows) {
    async function* prompts(): AsyncGenerator<SDKUserMessage> {
      yield {
        type: 'user',
        uuid: randomUUID(),
        message: { role: 'user', content: contextText },
        parent_tool_use_id: null,
        shouldQuery: false,
      };
    }
    seeded = await collect(prompts(), workspace, nativeConfigDirectory);
    if (!seeded.success || !seeded.actualSessionId)
      throw new Error(seeded.error || 'Native context append failed.');
  }
  const command = await collect(
    '/context',
    workspace,
    nativeConfigDirectory,
    seeded?.actualSessionId,
  );
  const packets = command.events.filter(
    (message) => message.type === 'assistant' && message.context_usage,
  );
  if (packets.length !== 1)
    throw new Error(command.error || 'One structured native context_usage report was expected.');
  const packet = packets[0],
    usage = usageSchema.parse(packet.context_usage),
    view = contextView(usage);
  const runs = seeded ? [seeded, command] : [command];
  const usedSum = usage.categories
    .filter((category) => category.kind === 'used')
    .reduce((sum, category) => sum + category.tokens, 0);
  const checks = {
    actualNativeOperationsSucceeded: runs.every((run) => run.success && !run.error),
    actualInitAndResultIdentifiersMatch: runs.every(
      (run) => Boolean(run.actualSessionId) && run.actualSessionId === run.actualResultSessionId,
    ),
    explicitResumeUsesSeedHistoryWhenPresent:
      !seeded || command.actualSessionId === seeded.actualSessionId,
    actualReportIsLocalContextCommand:
      packet.local_command_run?.command === 'context' && packet.message.model === '<synthetic>',
    noAssistantModelTurnsOrCharges: runs.every(
      (run) => run.turns === 0 && run.costUsd === 0 && run.durationApiMs === 0,
    ),
    usedCategoriesMatchNativeTotal: usedSum === usage.total_tokens,
    reportedBudgetComponentsMatchWindow:
      Math.abs(
        usage.categories.reduce((sum, category) => sum + category.tokens, 0) - usage.raw_max_tokens,
      ) <= 1,
    largestContributorExcludesFreeAndReserved:
      view.largestUsedContributor === null
        ? usedSum === 0
        : view.largestUsedContributor.kind === 'used' &&
          view.largestUsedContributor.tokens ===
            Math.max(
              ...usage.categories
                .filter((category) => category.kind === 'used')
                .map((category) => category.tokens),
            ),
    ownedHistoryProducesPositiveUsageWhenPresent: rows === 0 || usage.total_tokens > 0,
  };
  return {
    profile,
    topic,
    rows,
    contextCharacters: contextText.length,
    workspace,
    nativeConfigDirectory,
    marker,
    seeded,
    command,
    rawContextUsage: usage,
    nativeMarkdown: command.resultText,
    view,
    checks,
    verified: Object.values(checks).every(Boolean),
  };
}
