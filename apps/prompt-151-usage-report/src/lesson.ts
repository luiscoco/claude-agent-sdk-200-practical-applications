import { native, requireNative, report } from './native.js';
import { latestResult, usageView } from './accounting.js';
export async function run(mode: string) {
  const observed = await native(mode === 'live' ? 'Explain idempotent queue delivery in two sentences.' : 'Owned accounting baseline.', {}, mode === 'live');
  requireNative(observed, mode !== 'live'); const result = latestResult(observed.events);
  return report(usageView(result), { actualFinalUsagePacketCaptured: Boolean(result?.usage),
    estimatedCostIsFinite: Number.isFinite(result?.total_cost_usd),
    ...(mode === 'live' ? { realInferenceUsageObserved: result.num_turns > 0 && result.usage.output_tokens > 0 }
      : { localBaselineHasZeroApiDuration: result.duration_api_ms === 0 }),
  }, observed, 'Input/output/cache fields and per-model totals come directly from the actual final native result. Costs are SDK estimates, not invoices. A zero-inference local baseline is labelled as such.');
}
