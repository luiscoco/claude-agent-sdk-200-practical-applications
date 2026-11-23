import { native, requireNative, report } from './native.js';
import { latestResult, usageView, uniqueMessageUsage } from './accounting.js';
export async function run(mode: string) {
  const observed = await native(mode === 'live' ? 'Use reviewer to explain one queue safeguard, then summarize it.' : 'Owned per-model accounting baseline.', {
    tools: ['Agent'], allowedTools: ['Agent'], forwardSubagentText: true,
    agents: { reviewer: { description: 'Review a queue safeguard.', prompt: 'Explain idempotency in one sentence.', tools: [], model: 'inherit', maxTurns: 2 } },
  }, mode === 'live');
  requireNative(observed, mode !== 'live'); const result = latestResult(observed.events);
  const parentMessages = observed.events.filter(e => !e.parent_tool_use_id && !e.agent_id);
  return report({ nativeWholeTree: usageView(result), parentAssistantMessages: uniqueMessageUsage(parentMessages),
    distinction: 'Native modelUsage includes query-pipeline main, specialist and internal calls. Parent-message usage is a narrower stream-derived view.' }, {
    nativePerModelMapCaptured: typeof result?.modelUsage === 'object',
    ...(mode === 'live' ? { actualModelBucketObserved: Object.keys(result.modelUsage).length > 0 } : {}),
  }, observed, 'The app displays per-model buckets without summing duplicate cumulative results. It does not invent separate parent/specialist billing from a model bucket shared by both.');
}
