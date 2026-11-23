import { inspect } from './capabilities.js';
import { conversation } from './conversation.js';
import { taskServer } from './task-server.js';
import { waitMcp } from './mcp-fixture.js';
import { report } from './native.js';
export async function run(mode: string) {
  const config = await taskServer();
  const env = { ...process.env, CLAUDE_AUTO_BACKGROUND_TASKS: '1', CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND: '0', CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS: '250' };
  const options = { mcpServers: { reports: config }, env, allowedTools: ['mcp__reports__build_report'] };
  const discovery = await inspect(options, async runtime => ({ servers: await waitMcp(runtime), provider: (await runtime.accountInfo()).apiProvider }));
  const live = mode === 'live' ? await conversation(options, async host => {
    const turn = await host.send('Call the reports build_report tool. Wait for its actual server-side task to complete, then return its result.', true);
    const completed = await host.waitFor(e => e.type === 'system' && e.subtype === 'task_notification' && e.status === 'completed', 15000);
    return { turn, completed };
  }) : null;
  const info = discovery.change as any;
  return report({ requiredFlags: { CLAUDE_AUTO_BACKGROUND_TASKS: '1', CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND: '0', CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS: '250' },
    protocolRequirement: '2026-07-28 task support plus runtime feature-flag availability; streaming input stays open',
    provider: info.provider, serverStatuses: info.servers, liveTasks: live?.events.filter(e => /task/.test(e.subtype || '')) }, {
    actualTaskServerConnected: info.servers.some((s: any) => s.name === 'reports' && s.status === 'connected'),
    ...(live ? { actualTaskCompletionObserved: Boolean(live.value.completed),
      actualServerReportReturned: JSON.stringify(live.events).includes('TASK_REPORT_COMPLETE') } : {}),
  }, { discovery, live }, 'The owned server implements task handles and tasks/get/cancel. Local connection does not prove task activation. Live mode requires actual background completion. Third-party providers and sessions without required feature flags may lack server-side task support and fail the live check.');
}
