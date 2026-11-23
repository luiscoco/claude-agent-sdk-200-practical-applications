import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const env = { ...process.env, API_TIMEOUT_MS: '10000', CLAUDE_CODE_MAX_RETRIES: '1', CLAUDE_ENABLE_STREAM_WATCHDOG: '1', CLAUDE_STREAM_IDLE_TIMEOUT_MS: '300000', CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS: '300000' };
  let failures = 0;
  const server = createSdkMcpServer({ name: 'recovery', version: '1.0.0', tools: [tool('read_report', 'Read an owned report; the first request has a recoverable failure.', {}, async () => {
    failures++; return failures === 1 ? { content: [{ type: 'text', text: 'Temporary owned tool failure; retry once.' }], isError: true }
      : { content: [{ type: 'text', text: 'RECOVERED_REPORT' }] };
  })] });
  const observed = await native(mode === 'live' ? 'Read recovery read_report. If it reports a temporary failure, retry exactly once, then return the report.' : 'Owned timeout configuration baseline.', {
    env, mcpServers: { recovery: server }, allowedTools: ['mcp__recovery__read_report'],
  }, mode === 'live'); requireNative(observed, mode !== 'live');
  return report({ timeoutConfiguration: { apiHeadersTimeoutMs: 10000, apiRetries: 1, streamIdleMs: 300000, specialistStallMs: 300000 }, callbackAttempts: failures,
    distinction: 'These are separate API-attempt, stream-idle and specialist-stall controls. The live fault is a tool failure, not a claimed provider timeout.' }, {
    actualConfiguredRuntimeStarts: observed.success,
    ...(mode === 'live' ? { recoverableToolFailureActuallyRetried: failures === 2,
      finalReportActuallyReturned: observed.events.some(e => e.type === 'result' && e.result?.includes('RECOVERED_REPORT')) } : {}),
  }, observed, 'The configured timeout knobs are real runtime settings. The owned recoverable failure exercises tool recovery without pretending to force a provider outage or waiting five minutes for a stream watchdog.');
}
