import { inspect } from './capabilities.js';
import { mcpFixture, waitMcp } from './mcp-fixture.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const config = await mcpFixture();
  const observed = await inspect({}, async runtime => {
    const added = await runtime.setMcpServers({ classroom: config }); const connected = await waitMcp(runtime);
    await runtime.toggleMcpServer('classroom', false); const disabled = await runtime.mcpServerStatus();
    await runtime.toggleMcpServer('classroom', true); await runtime.reconnectMcpServer('classroom'); const reconnected = await waitMcp(runtime);
    const removed = await runtime.setMcpServers({}); const final = await runtime.mcpServerStatus();
    return { added, connected, disabled, reconnected, removed, final };
  });
  const state = observed.change as any;
  const live = mode === 'live' ? await native('Call the classroom policy tool and summarize its required retry limit.', { mcpServers: { classroom: config }, allowedTools: ['mcp__classroom__policy'] }, true) : null;
  if (live) requireNative(live, false);
  return report(state, { dynamicServerActuallyConnected: state.connected.some((s: any) => s.name === 'classroom' && s.status === 'connected'),
    disableActuallyReported: state.disabled.some((s: any) => s.name === 'classroom' && s.status === 'disabled'),
    reconnectActuallySucceeded: state.reconnected.some((s: any) => s.name === 'classroom' && s.status === 'connected'),
    dynamicallyOwnedServerRemoved: !state.final.some((s: any) => s.name === 'classroom'),
    ...(live ? { actualModelCallsMcp: live.events.some(e => e.type === 'assistant' && e.message?.content?.some((b: any) => b.name === 'mcp__classroom__policy')) } : {}),
  }, { observed, live }, 'The exercise adds, disables, reconnects and removes one dynamically owned stdio server. It does not claim that setMcpServers({}) removes plugin-owned or project-configured servers.');
}
