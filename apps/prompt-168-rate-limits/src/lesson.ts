import { native, requireNative, report } from './native.js';
export function retryPolicy(event: any) {
  if (event.type === 'system' && event.subtype === 'api_retry') return { layer: 'native-runtime', resubmitJob: false };
  if (event.type === 'rate_limit_event') return { layer: 'rate-limit-information', resubmitJob: false };
  return { layer: 'application', resubmitJob: event.type === 'job_failed' && event.idempotent === true && event.attempt < 3 };
}
export async function run(mode: string) {
  const fixtures = [{ type: 'system', subtype: 'api_retry' }, { type: 'rate_limit_event' }, { type: 'job_failed', idempotent: true, attempt: 1 }, { type: 'job_failed', idempotent: false, attempt: 1 }];
  const observed = await native(mode === 'live' ? 'Reply with one safe queue retry guideline.' : 'Owned retry policy baseline.', { env: { ...process.env, CLAUDE_CODE_MAX_RETRIES: '1' } }, mode === 'live');
  requireNative(observed, mode !== 'live');
  return report({ explicitParserFixtures: fixtures.map(event => ({ event, decision: retryPolicy(event) })),
    actualNativeRetryAndRateEvents: observed.events.filter(e => e.subtype === 'api_retry' || e.type === 'rate_limit_event'),
    observation: 'A successful run may produce no rate-limit event; that is not relabelled as a simulated live 429.' }, {
    noDuplicateJobSubmissionDuringNativeRetry: !retryPolicy(fixtures[0]).resubmitJob,
    nonIdempotentJobNotAutomaticallyRetried: !retryPolicy(fixtures[3]).resubmitJob,
    idempotentJobCanUseBoundedApplicationRetry: retryPolicy(fixtures[2]).resubmitJob,
  }, observed, 'Synthetic event fixtures test the application policy explicitly. Actual runtime retry/rate events are shown separately, preserving the distinction between a native API retry and a whole-job resubmission.');
}
