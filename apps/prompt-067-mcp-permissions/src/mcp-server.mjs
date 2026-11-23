import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile, appendFile } from 'node:fs/promises';
import { z } from 'zod';
const [catalogFile, auditFile] = process.argv.slice(2);
if (!catalogFile || !auditFile) throw new Error('Expected classroom catalog and audit paths.');
const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
const server = new McpServer({ name: 'classroom-permission-catalog', version: '1.0.0' });
async function result(name, input, outcome) {
  await appendFile(
    auditFile,
    JSON.stringify({ name, input, outcome, processId: process.pid }) + '\n',
  );
  return { content: [{ type: 'text', text: JSON.stringify(outcome) }], structuredContent: outcome };
}
server.registerTool(
  'read_lesson',
  {
    description: 'Read one synthetic classroom lesson by its exact slug.',
    inputSchema: { slug: z.string().min(1).max(80) },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ slug }) =>
    result(
      'read_lesson',
      { slug },
      { slug, lesson: Object.hasOwn(catalog, slug) ? catalog[slug] : null, processId: process.pid },
    ),
);
server.registerTool(
  'list_lessons',
  {
    description: 'List the synthetic classroom lesson slugs.',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () =>
    result('list_lessons', {}, { slugs: Object.keys(catalog).sort(), processId: process.pid }),
);
// stdout is reserved for MCP protocol messages.
await server.connect(new StdioServerTransport());
