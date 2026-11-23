import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile, appendFile } from 'node:fs/promises';
import { z } from 'zod';

// stdout belongs to the MCP transport. Diagnostics use stderr.
const [catalogFile, auditFile] = process.argv.slice(2);
if (!catalogFile || !auditFile) throw new Error('Expected catalog and audit paths.');
const server = new McpServer({ name: 'classroom-catalog', version: '1.0.0' });
server.registerTool(
  'get_lesson',
  {
    description: 'Look up synthetic classroom lesson metadata by its exact slug.',
    inputSchema: { slug: z.string().min(1).max(80) },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ slug }) => {
    const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
    const lesson = Object.hasOwn(catalog, slug) ? catalog[slug] : null;
    const outcome = {
      ok: Boolean(lesson),
      slug,
      lesson,
      errorCode: lesson ? '' : 'LESSON_NOT_FOUND',
      processId: process.pid,
      transport: 'stdio',
    };
    await appendFile(
      auditFile,
      JSON.stringify({ input: { slug }, outcome, processId: process.pid }) + '\n',
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(outcome) }],
      structuredContent: outcome,
      isError: !lesson,
    };
  },
);
await server.connect(new StdioServerTransport());
