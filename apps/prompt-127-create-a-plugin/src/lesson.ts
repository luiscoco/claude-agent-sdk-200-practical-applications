import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { plugin } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  const directory = await plugin('queue-kit');
  await mkdir(path.join(directory, 'agents'), { recursive: true });
  await writeFile(path.join(directory, 'agents/auditor.md'), '---\nname: auditor\ndescription: Audit classroom queues.\ntools: Read\n---\nAudit only owned queue requirements.');
  await mkdir(path.join(directory, 'hooks'), { recursive: true });
  await writeFile(path.join(directory, 'hooks/audit.mjs'), "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write(JSON.stringify({})));\n");
  const command = '"' + process.execPath + '" "${CLAUDE_PLUGIN_ROOT}/hooks/audit.mjs"';
  await writeFile(path.join(directory, 'hooks/hooks.json'), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command }] }] } }));
  await mkdir(path.join(directory, 'mcp'), { recursive: true });
  await writeFile(path.join(directory, 'mcp/server.mjs'), `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';\nimport { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';\nconst server = new McpServer({ name: 'queue-policy', version: '1.0.0' });\nserver.registerTool('policy', { description: 'Return the owned queue policy', inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'Require idempotency and bounded retries.' }] }));\nawait server.connect(new StdioServerTransport());\n`);
  await writeFile(path.join(directory, '.mcp.json'), JSON.stringify({ mcpServers: { policy: { command: process.execPath, args: ['${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs'] } } }));
  const options = { plugins: [{ type: 'local' as const, path: directory }], tools: ['Skill'], settingSources: [], strictMcpConfig: false };
  const discovery = await inspect(options, async q => {
    let statuses = await q.mcpServerStatus();
    for (let attempt = 0; attempt < 40 && statuses.some(s => s.status === 'pending'); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      statuses = await q.mcpServerStatus();
    }
    return statuses;
  });
  const live = mode === 'live' ? await native('/queue-kit:greet', options, true) : null;
  if (live) requireNative(live, false);
  const statuses = discovery.change as any[];
  return report({ pluginDirectory: directory, manifest: JSON.parse(await readFile(path.join(directory, '.claude-plugin/plugin.json'), 'utf8')),
    nativePlugins: discovery.init?.plugins, nativeAgents: discovery.agents, nativeMcp: statuses, answer: live ? answer(live.events) : null }, {
    namespacedSkillDiscovered: hasName(discovery.commands, 'queue-kit:greet'),
    pluginAgentDiscovered: hasName(discovery.agents, 'queue-kit:auditor'),
    pluginMcpConnected: statuses.some(s => /policy/.test(s.name) && s.status === 'connected'),
    ...(live ? { actualPluginSkillRuns: answer(live.events).includes('QUEUE-KIT_GREETING') } : {}),
  }, { discovery, live }, 'A real local plugin bundles a manifest, skill, specialist, harmless SessionStart hook and stdio MCP policy server. Local checks inspect actual plugin/agent/MCP discovery; live mode invokes the namespaced skill.');
}
