import { native, requireNative, report } from './native.js';
import { latestResult, usageView } from './accounting.js';
export async function run(mode: string) {
  const prompt = 'A job may be delivered twice and retries are unlimited. Name the two missing queue safeguards: idempotency and retry bounds. Explain briefly.';
  const samples = [];
  for (const effort of ['low', 'high'] as const) {
    const start = performance.now();
    const observed = await native(mode === 'live' ? prompt : 'Owned thinking/effort configuration baseline.', { effort, thinking: { type: 'adaptive' } }, mode === 'live');
    requireNative(observed, mode !== 'live'); const result = latestResult(observed.events);
    samples.push({ effort, elapsedMs: performance.now() - start, answer: result?.result,
      quality: mode === 'live' ? { mentionsIdempotency: /idempotenc/i.test(result.result), mentionsRetryBound: /retr|bound/i.test(result.result) } : null,
      usage: usageView(result), evidence: observed });
  }
  return report({ samples, benchmarkScope: 'Two observed single samples; model/organization support may normalize effort. No statistical superiority is claimed.' }, {
    bothSupportedConfigurationsExecuted: samples.length === 2,
    ...(mode === 'live' ? { bothAnswersAddressTheTwoSafeguards: samples.every(s => s.quality?.mentionsIdempotency && s.quality?.mentionsRetryBound) } : {}),
  }, {}, 'Supported adaptive thinking and explicit low/high effort settings are exercised. Actual result quality, latency and estimated usage are displayed; requested effort is not presented as guaranteed effective model effort.');
}
