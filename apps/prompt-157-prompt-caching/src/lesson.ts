import { native, requireNative, report } from './native.js';
import { latestResult, usageView } from './accounting.js';
export async function run(mode: string) {
  const prefix = 'Owned static queue-policy reference.\n' + Array.from({ length: 180 }, (_, i) => `Policy ${i}: use bounded retries and idempotency keys for delivery.`).join('\n');
  const first = await native(mode === 'live' ? 'Give one queue safety rule.' : 'Owned cache configuration baseline.', { systemPrompt: prefix }, mode === 'live');
  requireNative(first, mode !== 'live');
  const second = mode === 'live' ? await native('Give one queue safety rule.', { systemPrompt: prefix }, true) : null;
  if (second) requireNative(second, false);
  const a = latestResult(first.events), b = second ? latestResult(second.events) : null;
  return report({ first: usageView(a), repeatedStablePrefix: usageView(b),
    observedCacheHit: Boolean((b?.usage?.cache_read_input_tokens ?? 0) > 0),
    lifetimeScope: 'Default cache lifetime is measured here. Alternate provider-supported TTLs require separate configuration and elapsed-time trials; no 1-hour hit is claimed.' }, {
    actualUsageFieldsPreserved: Boolean(a?.usage),
    ...(second ? { repeatedWorkloadActuallyExecuted: second.success,
      nativeCacheCountersPresent: typeof b?.usage?.cache_read_input_tokens === 'number' } : {}),
  }, { first, second }, 'Cache creation and read counters are reported from actual model results. A cache miss is a valid observation and is not rewritten as a hit; this example does not fabricate elapsed cache-lifetime experiments.');
}
