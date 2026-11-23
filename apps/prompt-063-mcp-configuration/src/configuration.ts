import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const requestSchema = z
  .object({
    mode: z.enum(['strict', 'merged', 'malformed']),
    slug: z.string().min(1).max(80),
  })
  .strict();
const stdioSchema = z
  .object({
    type: z.literal('stdio'),
    command: z.string().min(1),
    args: z.array(z.string()),
    alwaysLoad: z.boolean().optional(),
  })
  .strict();
export const configSchema = z.object({ mcpServers: z.record(z.string(), stdioSchema) }).strict();

export async function loadConfiguration(file: string) {
  const text = await readFile(file, 'utf8');
  return {
    ...configSchema.parse(JSON.parse(text)),
    sha256: createHash('sha256').update(text).digest('hex'),
  };
}
export async function prepareConfiguration(
  root: string,
  workspace: string,
  mode: 'strict' | 'merged' | 'malformed',
) {
  const paths = {
    node: process.execPath,
    server: path.join(root, 'src/mcp-server.mjs'),
    catalog: path.join(workspace, 'catalog.json'),
    audit: path.join(workspace, 'handler-audit.jsonl'),
  };
  const template = configSchema.parse(
    JSON.parse(await readFile(path.join(root, 'fixtures/mcp-template.json'), 'utf8')),
  );
  function resolve(value: string) {
    const resolved = value.replace(
      /\{\{(node|server|catalog|audit)\}\}/g,
      (_match, name: keyof typeof paths) => paths[name],
    );
    if (resolved.includes('{{')) throw new Error('Unknown configuration placeholder.');
    return resolved;
  }
  const explicit = {
    mcpServers: Object.fromEntries(
      Object.entries(template.mcpServers).map(([name, server]) => [
        name,
        { ...server, command: resolve(server.command), args: server.args.map(resolve) },
      ]),
    ),
  };
  const configFile = path.join(workspace, 'mcp-approved.json');
  const text =
    mode === 'malformed'
      ? await readFile(path.join(root, 'fixtures/malformed-config.txt'), 'utf8')
      : JSON.stringify(explicit, null, 2);
  await writeFile(configFile, text);
  const unintendedAudit = path.join(workspace, 'unintended-audit.jsonl');
  await writeFile(
    path.join(workspace, '.mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          unintended: {
            type: 'stdio',
            command: process.execPath,
            args: [paths.server, paths.catalog, unintendedAudit],
            alwaysLoad: true,
          },
        },
      },
      null,
      2,
    ),
  );
  return { configFile, unintendedAudit, loaded: await loadConfiguration(configFile) };
}
