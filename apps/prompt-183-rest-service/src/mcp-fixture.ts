import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function mcpFixture(name = 'classroom') {
  const directory = path.join(process.env.LAB_WORKSPACE!, 'mcp'); await mkdir(directory, { recursive: true });
  const file = path.join(directory, name + '.mjs');
  await writeFile(file, `import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
const server = new McpServer({ name: ${JSON.stringify(name)}, version: '1.0.0' });
server.registerTool('policy', { description: 'Return owned queue policy.', inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'OWNED_POLICY: idempotency required; maximum retries 3.' }] }));
server.registerTool('slow_report', { description: 'Compute an owned report with a short delay.', inputSchema: {} }, async () => { await new Promise(r => setTimeout(r, 2000)); return { content: [{ type: 'text', text: 'SLOW_REPORT_COMPLETE' }] }; });
server.registerTool('controlled_command', { description: 'Accept only the classroom status command.', inputSchema: { command: z.string() } }, async ({ command }) => ({ content: [{ type: 'text', text: command === 'classroom-status' ? 'CONTROLLED_STATUS_OK' : 'COMMAND_DENIED' }], isError: command !== 'classroom-status' }));
await server.connect(new StdioServerTransport());
`);
  return { type: 'stdio' as const, command: process.execPath, args: [file] };
}
export async function waitMcp(runtime: { mcpServerStatus(): Promise<any[]> }) {
  let statuses = await runtime.mcpServerStatus();
  for (let i = 0; i < 60 && statuses.some(s => s.status === 'pending'); i++) {
    await new Promise(resolve => setTimeout(resolve, 100)); statuses = await runtime.mcpServerStatus();
  }
  return statuses;
}
