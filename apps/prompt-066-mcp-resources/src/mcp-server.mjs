import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile, appendFile } from 'node:fs/promises';
import { z } from 'zod';

const [fixtureFile, auditFile] = process.argv.slice(2);
if (!fixtureFile || !auditFile) throw new Error('Expected classroom fixture and audit paths.');
const resources = JSON.parse(await readFile(fixtureFile, 'utf8'));
const server = new Server(
  { name: 'classroom-resource-library', version: '1.0.0' },
  { capabilities: { resources: {}, tools: {} } },
);
async function audit(method, input, result, error = '') {
  await appendFile(
    auditFile,
    JSON.stringify({ method, input, result: result ?? null, error, processId: process.pid }) + '\n',
  );
}
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const result = {
    resources: resources.map(({ uri, name, mimeType, title }) => ({
      uri,
      name,
      mimeType,
      title,
      description: 'Synthetic classroom lesson context.',
    })),
  };
  await audit('resources/list', {}, result);
  return result;
});
server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
  const resource = resources.find((resource) => resource.uri === params.uri);
  if (!resource) {
    await audit('resources/read', params, null, 'RESOURCE_NOT_FOUND');
    throw new McpError(-32002, 'Classroom resource not found', { uri: params.uri });
  }
  const result = {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: JSON.stringify({
          title: resource.title,
          paragraph: resource.paragraph,
          segments: resource.segments,
        }),
      },
    ],
  };
  await audit('resources/read', params, result);
  return result;
});
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'total_minutes',
      description: 'Add the bounded synthetic lesson segment durations supplied as arguments.',
      inputSchema: {
        type: 'object',
        properties: {
          segments: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 60 },
            minItems: 1,
            maxItems: 10,
          },
        },
        required: ['segments'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  ],
}));
const inputSchema = z
  .object({ segments: z.array(z.number().int().min(0).max(60)).min(1).max(10) })
  .strict();
server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
  if (params.name !== 'total_minutes')
    throw new McpError(ErrorCode.InvalidParams, 'Unknown classroom tool.');
  const input = inputSchema.parse(params.arguments);
  const outcome = {
    segments: input.segments,
    totalMinutes: input.segments.reduce((sum, minutes) => sum + minutes, 0),
    processId: process.pid,
  };
  const result = {
    content: [{ type: 'text', text: JSON.stringify(outcome) }],
    structuredContent: outcome,
  };
  await audit('tools/call', { name: params.name, arguments: input }, result);
  return result;
});
// stdout carries MCP protocol messages. The audit uses its separate file.
await server.connect(new StdioServerTransport());
