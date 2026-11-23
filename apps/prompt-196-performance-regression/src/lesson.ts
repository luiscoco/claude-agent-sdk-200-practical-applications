import { performance } from 'node:perf_hooks';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const tasks = [{ input: 'RETRY', expected: 3 }, { input: 'retry', expected: 3 }, { input: ' retry ', expected: 3 }];
  function benchmark(version: string, resolve: (input: string) => number | null) { const started = performance.now(); const results = tasks.map(task => ({ input: task.input, actual: resolve(task.input), expected: task.expected })); return { version, results, completionRate: results.filter(row => row.actual === row.expected).length / tasks.length, elapsedMs: performance.now() - started, tokens: null, estimatedSpendingUsd: null }; }
  const before = benchmark('case-sensitive-v1', input => input === 'retry' ? 3 : null), after = benchmark('normalized-v2', input => input.trim().toLowerCase() === 'retry' ? 3 : null);
  const observed = [];
  for (const version of [before, after]) { const run = await native(`Explain the observable completion rate of ${version.version}: ${version.completionRate}. Do not invent token savings.`, {}, mode === 'live'); requireNative(run, mode !== 'live'); observed.push({ version: version.version, run }); }
  const actualUsage = observed.map(({ version, run }) => ({ version, costUsd: mode === 'live' ? run.costUsd : null, resultUsage: mode === 'live' ? run.events.findLast(e => e.type === 'result')?.usage : null }));
  return report({ before, after, actualUsage, liveExperiment: 'Two bounded explanatory queries; they are not application-version inference benchmarks.' }, { regressionDatasetShared: before.results.length === after.results.length, completionImproves: after.completionRate > before.completionRate, bothDurationsMeasured: before.elapsedMs >= 0 && after.elapsedMs >= 0, noFabricatedModelUsage: mode === 'live' || actualUsage.every(row => row.costUsd === null) }, observed, 'Actual deterministic application regression dataset with measured wall time. Single samples do not establish statistically significant latency improvements; local model tokens/spend are unmeasured (null).');
}
