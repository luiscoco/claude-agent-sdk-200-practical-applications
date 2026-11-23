import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { collector, telemetryEnv } from './observability.js';
export async function run(mode: string) {
  const receiver = await collector();
  try {
    const env = telemetryEnv(receiver.endpoint);
    const observed = await inspect({ env }, async () => { await new Promise(resolve => setTimeout(resolve, 2200)); return { destination: receiver.endpoint }; });
    const live = mode === 'live' ? await native('Reply with one queue safety rule.', { env }, true) : null;
    if (live) requireNative(live, false);
    const metrics = receiver.requests.filter(r => r.path === '/v1/metrics'), logs = receiver.requests.filter(r => r.path === '/v1/logs');
    return report({ collector: receiver.endpoint, metrics, logs, receivedRequests: receiver.requests.length }, {
      actualOtlpMetricsArrived: metrics.some(r => r.bytes > 0),
      nativeSessionMetricPresent: JSON.stringify(metrics).includes('claude_code.session.count'),
      ...(live ? { actualLiveTelemetryArrived: logs.some(r => r.bytes > 0) } : {}),
    }, { observed, live }, 'A real loopback HTTP/JSON OTLP collector receives exports from the actual native runtime. No handcrafted telemetry packet is posted as proof of SDK export. Raw prompt/body logging is disabled.');
  } finally { await receiver.close(); }
}
