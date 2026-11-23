import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { appendFile } from 'node:fs/promises';
import { z } from 'zod';
const [auditFile] = process.argv.slice(2);
if (!auditFile) throw new Error('Expected classroom audit path.');
const server = new McpServer({ name: 'classroom-elicitation-survey', version: '1.0.0' });
async function audit(event, value) {
  await appendFile(auditFile, JSON.stringify({ event, value, processId: process.pid }) + '\n');
}
server.registerTool(
  'prepare_report',
  {
    description:
      'Prepare a synthetic classroom report after requesting its format through MCP form elicitation.',
    inputSchema: { topic: z.enum(['MCP', 'Hooks']) },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => {
    await audit('handler-started', input);
    const request = {
      mode: 'form',
      message: 'Choose the format for this synthetic classroom report.',
      requestedSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', title: 'Report format', enum: ['brief', 'detailed'] },
        },
        required: ['format'],
      },
    };
    await audit('elicitation-request', request);
    const response = await server.server.elicitInput(request, { timeout: 180000 });
    await audit('elicitation-response', response);
    let outcome;
    if (response.action === 'accept') {
      const content = z.object({ format: z.enum(['brief', 'detailed']) }).parse(response.content);
      outcome = {
        ok: true,
        topic: input.topic,
        format: content.format,
        text:
          content.format === 'brief'
            ? `${input.topic} classroom report.`
            : `${input.topic} classroom report with an example, observed evidence and an exercise.`,
        errorCode: '',
      };
    } else
      outcome = {
        ok: false,
        topic: input.topic,
        format: null,
        text: null,
        errorCode: response.action === 'decline' ? 'ELICITATION_DECLINED' : 'ELICITATION_CANCELLED',
      };
    await audit('handler-result', outcome);
    return {
      content: [{ type: 'text', text: JSON.stringify(outcome) }],
      structuredContent: outcome,
      isError: !outcome.ok,
    };
  },
);
await server.connect(new StdioServerTransport());
