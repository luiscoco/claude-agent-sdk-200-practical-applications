import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { appendFile } from 'node:fs/promises';
import { z } from 'zod';

const [role, auditFile] = process.argv.slice(2);
if (!['core', 'catalog'].includes(role) || !auditFile)
  throw new Error('Expected classroom role and audit path.');
const server = new McpServer({ name: 'classroom-search-' + role, version: '1.0.0' });
async function result(name, input, outcome) {
  await appendFile(
    auditFile,
    JSON.stringify({ name, input, outcome, processId: process.pid }) + '\n',
  );
  return { content: [{ type: 'text', text: JSON.stringify(outcome) }], structuredContent: outcome };
}
if (role === 'core') {
  server.registerTool(
    'health',
    {
      description:
        'Return the synthetic classroom library readiness. This is the core always-loaded tool.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => result('health', {}, { ready: true, processId: process.pid }),
  );
} else {
  for (let lessonId = 1; lessonId <= 48; lessonId++) {
    const key = String(lessonId).padStart(2, '0');
    const description =
      `Retrieve synthetic classroom metadata for lesson ${key}. Search keywords include lesson_${key}, classroom catalog, lesson number ${lessonId}, and duration. This benchmark deliberately publishes verbose descriptions for 48 independent tools so the native auto threshold has a measurable catalog to evaluate. The tool accepts its exact lessonId and returns that same identifier, a synthetic title, minutes, and the server process identifier. It is a read-only classroom lookup with deterministic data. ` +
      `A learner can use the returned title and minute count to identify the requested lesson and compare the native result with the server audit. The host validates the exact requested lesson identifier before admitting the classroom lookup. Each tool definition represents one distinct lesson and its own fixed input literal. These descriptions supply context for the search mechanism and describe the protocol input and result fields used by the experiment. ` +
      `The experiment compares a low activation percentage, a high activation percentage, and explicitly disabled search while keeping the catalog size and requested lesson constant. Its separate core server exposes a short always-loaded readiness tool. The application captures native context categories, individual MCP tool loading flags, actual search calls, handler events, and SDK-reported timing for each measured run. Use the particular lesson tool when the task requests its matching identifier. ` +
      `All lesson records and delays in this classroom catalog are synthetic. The server performs the lookup in memory and appends its actual invocation to a separate audit file. Its standard output carries only MCP protocol messages. The returned process identifier makes the handler outcome traceable to the owned server process. The structured result preserves the exact requested lesson number and deterministic duration for comparison with the native tool response.`;
    server.registerTool(
      'lesson_' + key,
      {
        description,
        inputSchema: { lessonId: z.literal(lessonId) },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (input) =>
        result('lesson_' + key, input, {
          lessonId,
          title: 'Classroom lesson ' + key,
          minutes: 5 + (lessonId % 6),
          processId: process.pid,
        }),
    );
  }
}
await server.connect(new StdioServerTransport());
