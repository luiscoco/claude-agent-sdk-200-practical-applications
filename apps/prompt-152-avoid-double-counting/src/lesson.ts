import { native, requireNative, report } from './native.js';
import { uniqueMessageUsage, latestResult, usageView } from './accounting.js';
export async function run(mode: string) {
  const fixture = { type: 'assistant', message: { id: 'owned-fixture-message', usage: { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 2 } } };
  const replay = uniqueMessageUsage([fixture, fixture, { type: 'stream_event', event: { type: 'content_block_delta' } }]);
  const observed = await native(mode === 'live' ? 'Give one concise queue retry rule.' : 'Owned deduplication baseline.', { includePartialMessages: true }, mode === 'live');
  requireNative(observed, mode !== 'live');
  return report({ fixtureContract: replay, actualAssistantMessageUsage: uniqueMessageUsage(observed.events), authoritativeNativeTreeTotals: usageView(latestResult(observed.events)) }, {
    repeatedFixtureIdCountedOnce: replay.uniqueApiMessages === 1 && replay.totals.input === 10 && replay.totals.output === 4,
    actualNativeOperationSucceeded: observed.success,
    ...(mode === 'live' ? { actualUniqueApiMessageObserved: uniqueMessageUsage(observed.events).uniqueApiMessages > 0 } : {}),
  }, observed, 'The small replay is an explicitly synthetic parser fixture. Actual assistant-message usage is deduplicated by API message ID; stream deltas are not additional API messages. Whole-tree accounting uses native final modelUsage instead of summing every streamed result.');
}
