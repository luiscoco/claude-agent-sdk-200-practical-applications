import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const [stateFile, auditFile] = process.argv.slice(2);
if (!stateFile || !auditFile) throw new Error('Expected classroom state and audit paths.');
const state = z
  .object({ available: z.boolean(), disconnect: z.boolean() })
  .parse(JSON.parse(await readFile(stateFile, 'utf8')));
async function audit(event, value) {
  await appendFile(auditFile, JSON.stringify({ event, value, processId: process.pid }) + '\n');
}
await audit('boot', state);
const server = new McpServer({ name: 'classroom-recovery-server', version: '1.0.0' });
if (state.available)
  server.registerTool(
    'get_items',
    {
      description:
        'Return bounded synthetic classroom rows. This isolated fixture can disconnect its own server to demonstrate recovery.',
      inputSchema: { count: z.number().int().min(1).max(400) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      await audit('handler-started', input);
      if (state.disconnect) {
        await audit('intentional-disconnect', { reason: 'Owned classroom process fixture.' });
        process.exit(0);
      }
      const rows = Array.from({ length: input.count }, (_, index) => ({
        id: index + 1,
        text: `Synthetic classroom record ${String(index + 1).padStart(4, '0')} for bounded MCP recovery practice.`,
      }));
      const text = JSON.stringify({ count: rows.length, rows });
      await audit('handler-result', {
        count: rows.length,
        characters: text.length,
        sha256: createHash('sha256').update(text).digest('hex'),
        firstRows: rows.slice(0, 10),
      });
      return { content: [{ type: 'text', text }] };
    },
  );
await server.connect(new StdioServerTransport());
