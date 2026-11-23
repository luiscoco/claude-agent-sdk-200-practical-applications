import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const calls: string[] = [];
  const server = createSdkMcpServer({ name: 'controlled', version: '1.0.0', tools: [tool('command', 'Accept only classroom-status.', { command: z.string() }, async ({ command }) => {
    calls.push(command); return { content: [{ type: 'text', text: command === 'classroom-status' ? 'CONTROLLED_STATUS_OK' : 'COMMAND_DENIED' }], isError: command !== 'classroom-status' };
  })] });
  const options = { tools: ['Bash'], toolAliases: { Bash: 'mcp__controlled__command' },
    mcpServers: { controlled: server }, allowedTools: ['mcp__controlled__command'],
    canUseTool: async () => ({ behavior: 'deny' as const, message: 'Native shell execution is not permitted.' }) };
  const discovery = await inspect(options);
  const live = mode === 'live' ? await native('Use Bash to execute the exact classroom command classroom-status. Report the returned status.', options, true) : null;
  if (live) requireNative(live, false);
  return report({ alias: options.toolAliases, controlledCallbackInputs: calls, result: live?.events.findLast(e => e.type === 'result')?.result }, {
    actualRuntimeLoadsAliasConfiguration: discovery.result.num_turns === 0,
    ...(live ? { controlledImplementationActuallyCalled: calls.includes('classroom-status'),
      noUnexpectedCommandAccepted: calls.every(command => command === 'classroom-status'),
      actualStatusReturned: live.events.some(e => e.type === 'result' && e.result?.includes('CONTROLLED_STATUS_OK')) } : {}),
  }, { discovery, live }, 'The public toolAliases option routes the built-in name to a controlled SDK MCP callback. Live evidence requires the callback to run; a discovered alias alone does not prove routing. The callback never invokes a shell.');
}
