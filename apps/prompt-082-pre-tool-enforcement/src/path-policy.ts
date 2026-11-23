import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { z } from 'zod';

export const requestSchema = z
  .object({
    mode: z.enum(['allowed', 'restricted', 'alias', 'sibling', 'no-hook']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export function isWithinDirectory(directory: string, target: string) {
  const relative = path.relative(directory, target);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))
  );
}
export async function inspectPath(workspace: string, directory: string, requestedPath: string) {
  const canonicalDirectory = await realpath(directory);
  const canonicalTarget = await realpath(path.resolve(workspace, requestedPath));
  return {
    canonicalDirectory,
    canonicalTarget,
    allowed: isWithinDirectory(canonicalDirectory, canonicalTarget),
  };
}
export const outputSchema = z
  .object({
    status: z.enum(['completed', 'permission-denied']),
    text: z.string().nullable(),
  })
  .strict();
