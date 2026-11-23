import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { collector, telemetryEnv } from './observability.js';
export async function run(mode: string) {
  const failed = await collector(503), recovered = await collector(); let diagnostics = '';
  try {
    const broken = await inspect({ env: { ...telemetryEnv(failed.endpoint), OTEL_LOG_LEVEL: 'debug' }, stderr: data => { diagnostics = (diagnostics + data).slice(-12000); } },
      async () => { await new Promise(resolve => setTimeout(resolve, 2200)); return {}; });
    const healthy = await inspect({ env: telemetryEnv(recovered.endpoint) }, async () => { await new Promise(resolve => setTimeout(resolve, 1200)); return {}; });
    const live = mode === 'live' ? await native('Reply TELEMETRY_RECOVERED.', { env: telemetryEnv(recovered.endpoint) }, true) : null;
    if (live) requireNative(live, false);
    return report({ rejectedExportRequests: failed.requests.length, stderrDiagnostics: diagnostics, recoveredExportRequests: recovered.requests.length }, {
      actualExporterFailureInjected: failed.requests.length > 0,
      nativeProtocolSurvivesExporterFailure: broken.result.subtype === 'success',
      healthyDestinationReceivesExports: recovered.requests.length > 0,
      ...(live ? { realModelRunsAfterRecovery: live.success } : {}),
    }, { broken, healthy, live }, 'The first owned collector actually returns HTTP 503, then a healthy collector receives exports. Exporter diagnostics are captured from stderr; nothing is injected into the SDK JSON protocol stdout.');
  } finally { await failed.close(); await recovered.close(); }
}
