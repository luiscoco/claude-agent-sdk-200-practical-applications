import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { collector, telemetryEnv } from './observability.js';
import { mcpFixture } from './mcp-fixture.js';
export async function run(mode: string) {
  const receiver = await collector(); let hookCalls = 0;
  try {
    const env = { ...telemetryEnv(receiver.endpoint), CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: '1', OTEL_TRACES_EXPORTER: 'otlp',
      ENABLE_BETA_TRACING_DETAILED: '1', BETA_TRACING_ENDPOINT: receiver.endpoint };
    const options = { env, hooks: { SessionStart: [{ hooks: [async () => { hookCalls++; return {}; }] }] } };
    const observed = await inspect(options, async () => { await new Promise(resolve => setTimeout(resolve, 2200)); return {}; });
    const config = mode === 'live' ? await mcpFixture() : null;
    const live = mode === 'live' ? await native('Call classroom policy, then reply TRACE_MODEL_OK with the retry limit.', {
      ...options, mcpServers: { classroom: config! }, allowedTools: ['mcp__classroom__policy'],
    }, true) : null;
    if (live) requireNative(live, false);
    const traces = receiver.requests.filter(r => /traces/.test(r.path)), text = JSON.stringify(traces);
    return report({ betaFlags: ['CLAUDE_CODE_ENHANCED_TELEMETRY_BETA', 'ENABLE_BETA_TRACING_DETAILED'], hookCalls, traces,
      observedSpanNames: [...text.matchAll(/"name":"([^"]+)"/g)].map(match => match[1]),
      scope: 'Only spans actually received appear. Model/tool spans require corresponding live activity; beta support can vary.' }, {
      actualTraceExportArrived: traces.some(r => r.bytes > 0),
      ...(live ? { liveModelOperationCompleted: live.success, actualSessionStartHookExecuted: hookCalls > 0,
        actualLiveToolCallObserved: live.events.some(e => e.type === 'assistant' && e.message?.content?.some((b: any) => b.type === 'tool_use' && b.name === 'mcp__classroom__policy')) } : {}),
    }, { observed, live }, 'Tracing uses the documented beta flags and an owned loopback destination. No model or tool span is invented when the corresponding operation did not occur.');
  } finally { await receiver.close(); }
}
