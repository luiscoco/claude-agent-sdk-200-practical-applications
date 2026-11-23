import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { latestResult, usageView } from './accounting.js';
export async function run(mode: string) {
  const discovery = await inspect({}, q => q.supportedModels());
  const available = discovery.change as any[], choices = [process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    process.env.CLAUDE_COMPARISON_MODEL || available.find(m => /haiku/i.test(m.value))?.value].filter(Boolean);
  const models = [...new Set(choices)] as string[], samples = [];
  if (mode === 'live' && models.length < 2) throw new Error('Configure two distinct available model IDs for the live comparison.');
  if (mode === 'live') for (const model of models) {
    const start = performance.now(), observed = await native('Return the sum of 17 and 25 as digits only.', { model }, true);
    requireNative(observed, false); const result = latestResult(observed.events);
    samples.push({ requestedModel: model, elapsedMs: performance.now() - start, success: result.result?.trim() === '42', usage: usageView(result), observed });
  }
  return report({ advertisedModels: available.map(m => ({ value: m.value, resolvedModel: m.resolvedModel })), samples,
    benchmarkScope: 'One shared deterministic-answer task per model. An illustration, not a statistically reliable model ranking.' }, {
    actualModelInventoryCaptured: Array.isArray(available),
    ...(mode === 'live' ? { twoDistinctModelsActuallyRun: samples.length === 2, bothProduceCorrectObservableOutcome: samples.every(s => s.success) } : {}),
  }, discovery, 'The same task and success criterion are used for both requested models; actual modelUsage, elapsed time and estimated cost are retained. A missing comparison model is explicit, never silently replaced with the same model.');
}
