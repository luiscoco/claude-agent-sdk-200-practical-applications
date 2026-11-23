import { native, requireNative, report } from './native.js';
import { latestResult } from './accounting.js';
import { mcpFixture } from './mcp-fixture.js';
export async function run(mode: string) {
  const config = await mcpFixture(), observed = await native(mode === 'live'
    ? 'Call classroom policy, then explain its result. The report must depend on the tool output.' : 'Owned turn-limit configuration baseline.', {
    maxTurns: 1, mcpServers: { classroom: config }, allowedTools: ['mcp__classroom__policy'],
  }, mode === 'live');
  if (mode !== 'live') requireNative(observed);
  const result = latestResult(observed.events);
  return report({ configuredMaxTurns: 1, subtype: result?.subtype, terminalReason: result?.terminal_reason,
    iteratorException: observed.error ?? null, complete: result?.subtype === 'success' && !result?.is_error && !observed.error }, {
    actualResultOrFailureCaptured: Boolean(result || observed.error),
    ...(mode === 'live' ? { actualTurnLimitResultObserved: result?.subtype === 'error_max_turns' || result?.terminal_reason === 'max_turns',
      limitIsNotReportedComplete: result?.subtype !== 'success' || result?.is_error === true } : {}),
  }, observed, 'The real native stream is drained and any subsequent exception is captured separately from the result subtype. Live mode deliberately needs a tool round trip beyond a one-turn allowance; failure to hit the limit is an unmet check.');
}
