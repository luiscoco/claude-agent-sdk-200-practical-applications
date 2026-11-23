import { randomUUID } from 'node:crypto';
import { native, requireNative, report } from './native.js';
import { eventLog } from './observability.js';
export async function run(mode: string) {
  const canary = 'CLASSROOM_SECRET_CANARY', requestId = randomUUID();
  const observed = await native(mode === 'live' ? 'Describe one queue safeguard briefly.' : 'Owned logging baseline.', {}, mode === 'live');
  requireNative(observed, mode !== 'live');
  const logs = eventLog(requestId, [...observed.events, { type: 'assistant', apiKey: canary, message: { content: [{ type: 'text', text: canary }] } }]);
  return report({ logs, policy: 'Allowlist event metadata; omit raw prompts, responses, environment and credentials.' }, {
    secretAndUnneededContentExcluded: !JSON.stringify(logs).includes(canary),
    actualNativeSessionIdRetained: logs.some(row => row.sessionId === observed.sessionId),
    everyLogHasRequestAndSequence: logs.every((row, index) => row.requestId === requestId && row.sequence === index),
  }, { nativeEventCount: observed.events.length, nativeSuccess: observed.success }, 'An explicitly synthetic secret canary tests the logging allowlist. Actual native events are logged as selected metadata, without storing unnecessary conversation content in the structured log.');
}
