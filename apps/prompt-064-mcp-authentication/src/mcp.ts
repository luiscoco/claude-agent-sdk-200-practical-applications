import type { Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { ClassroomOAuth } from './oauth.js';

export const toolInputSchema = z.object({ slug: z.string().min(1).max(80) }).strict();
export const outcomeSchema = z
  .object({
    ok: z.boolean(),
    slug: z.string(),
    subject: z.string(),
    scope: z.literal('catalog.read'),
    lesson: z
      .object({ title: z.string(), minutes: z.number().int(), topics: z.array(z.string()) })
      .nullable(),
    errorCode: z.enum(['', 'LESSON_NOT_FOUND']),
    transport: z.literal('http'),
  })
  .strict();
export type Execution = {
  runId: string;
  input: { slug: string };
  tokenReference: string;
  processId: number;
  outcome: z.infer<typeof outcomeSchema>;
};
export type HttpEvent = {
  runId: string;
  method: string;
  authorized: boolean;
  subject: string | null;
  tokenReference: string | null;
  httpStatus: number | null;
};

export async function handleMcp(
  request: Request,
  response: Response,
  oauth: ClassroomOAuth,
  root: string,
  executions: Execution[],
  httpEvents: HttpEvent[],
) {
  const grant = oauth.authenticate(request.get('authorization'));
  const runId = request.get('x-course-run') || 'unmarked';
  const event: HttpEvent = {
    runId,
    method: String(request.body?.method || request.method),
    authorized: Boolean(grant),
    subject: grant?.subject ?? null,
    tokenReference: grant?.reference ?? null,
    httpStatus: null,
  };
  httpEvents.push(event);
  response.once('finish', () => {
    event.httpStatus = response.statusCode;
  });
  if (!grant) {
    response.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${oauth.issuer}/.well-known/oauth-protected-resource/mcp", scope="catalog.read"`,
    );
    response.status(401).json({
      error: 'invalid_token',
      error_description: 'A valid classroom catalog token is required.',
    });
    return;
  }
  const server = new McpServer({ name: 'classroom-protected-catalog', version: '1.0.0' });
  server.registerTool(
    'get_lesson',
    {
      description:
        'Read synthetic classroom lesson metadata. The HTTP resource server supplies the authenticated subject from its validated bearer token.',
      inputSchema: { slug: z.string().min(1).max(80) },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const input = toolInputSchema.parse(args);
      const catalog = JSON.parse(await readFile(path.join(root, 'fixtures/catalog.json'), 'utf8'));
      const lesson = Object.hasOwn(catalog, input.slug) ? catalog[input.slug] : null;
      const outcome = outcomeSchema.parse({
        ok: Boolean(lesson),
        slug: input.slug,
        subject: grant.subject,
        scope: grant.scope,
        lesson,
        errorCode: lesson ? '' : 'LESSON_NOT_FOUND',
        transport: 'http',
      });
      executions.push({
        runId,
        input,
        tokenReference: grant.reference,
        processId: process.pid,
        outcome,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
        isError: !lesson,
      };
    },
  );
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  response.once('close', () => {
    void Promise.allSettled([transport.close(), server.close()]);
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  } catch {
    if (!response.headersSent) response.status(500).json({ error: 'MCP_REQUEST_FAILED' });
  }
}
export function nativeOutcome(content: unknown) {
  const texts =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((block) => block?.type === 'text').map((block) => String(block.text))
        : [];
  for (const text of texts) {
    try {
      const parsed = outcomeSchema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {}
  }
  return null;
}
