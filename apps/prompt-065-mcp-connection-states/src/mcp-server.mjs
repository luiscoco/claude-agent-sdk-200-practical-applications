import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

const [auditFile, bootValue = '0'] = process.argv.slice(2);
const bootDelay = Number(bootValue);
if (!auditFile || !Number.isFinite(bootDelay) || bootDelay < 0 || bootDelay > 15000)
  throw new Error('Invalid classroom server arguments.');
async function log(event, input, outcome) {
  await appendFile(
    auditFile,
    JSON.stringify({
      event,
      input: input ?? null,
      outcome: outcome ?? null,
      processId: process.pid,
      at: Date.now(),
    }) + '\n',
  );
}
await log('boot');
await delay(bootDelay);
const server = new McpServer({ name: 'classroom-connection-server', version: '1.0.0' });
server.registerTool(
  'echo',
  {
    description: 'Echo a synthetic classroom message after the requested bounded work interval.',
    inputSchema: {
      message: z.string().min(1).max(160),
      workMs: z.number().int().min(0).max(10000),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => {
    await log('tool-started', input);
    await delay(input.workMs);
    const outcome = { message: input.message, workMs: input.workMs, processId: process.pid };
    await log('tool-completed', input, outcome);
    return {
      content: [{ type: 'text', text: JSON.stringify(outcome) }],
      structuredContent: outcome,
    };
  },
);
// stdout remains dedicated to MCP protocol messages.
await server.connect(new StdioServerTransport());
