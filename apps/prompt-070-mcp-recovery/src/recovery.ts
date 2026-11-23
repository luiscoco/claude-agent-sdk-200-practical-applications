import path from 'node:path';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { McpServerStatus } from '@anthropic-ai/claude-agent-sdk';

export const requestSchema = z
  .object({
    mode: z.enum(['disconnected', 'unavailable', 'oversized']),
    pageSize: z.number().int().min(1).max(10),
  })
  .strict();
export const rowSchema = z.object({ id: z.number().int().min(1), text: z.string() }).strict();
export const bodySchema = z
  .object({ count: z.number().int().min(1).max(400), rows: z.array(rowSchema).min(1).max(400) })
  .strict();
export const outputSchema = z
  .object({
    phase: z.enum(['diagnosed', 'recovered']),
    ok: z.boolean(),
    count: z.number().int().nullable(),
    ids: z.array(z.number().int()),
  })
  .strict();
export function advertisedTool(status: McpServerStatus[]) {
  return status.some(
    (server) =>
      server.name === 'service' &&
      server.status === 'connected' &&
      server.tools?.some((tool) => tool.name === 'get_items'),
  );
}
export function decodedBody(content: unknown) {
  const texts =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((block) => block?.type === 'text').map((block) => String(block.text))
        : [];
  for (const text of texts) {
    try {
      const parsed = bodySchema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {}
  }
  return null;
}
export async function auditEvents(file: string) {
  const text = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return text.trim()
    ? text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : [];
}
export async function persistedOutputProof(workspace: string, expectedHash: string) {
  const directory = path.join(workspace, 'native-config');
  const files = await readdir(directory, { recursive: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  const candidates = files.filter(
    (file) =>
      file.split(path.sep).includes('tool-results') &&
      path.basename(file).startsWith('mcp-service-get_items-') &&
      file.endsWith('.txt'),
  );
  if (candidates.length !== 1) throw new Error('Expected one native persisted MCP result file.');
  const canonicalRoot = await realpath(workspace),
    file = await realpath(path.join(directory, candidates[0]));
  const relative = path.relative(canonicalRoot, file);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep))
    throw new Error('The native result path escaped its owned classroom workspace.');
  const text = await readFile(file, 'utf8');
  const body = bodySchema.parse(JSON.parse(text));
  const sha256 = createHash('sha256').update(text).digest('hex');
  return {
    relativeFile: relative,
    characters: text.length,
    bytes: Buffer.byteLength(text),
    sha256,
    handlerHashMatches: sha256 === expectedHash,
    count: body.count,
    actualRows: body.rows.length,
    firstRows: body.rows.slice(0, 5),
  };
}
