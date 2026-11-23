import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';

export const requestSchema = z
  .object({ mode: z.enum(['resume', 'fresh']), topic: z.enum(['MCP', 'Hooks']) })
  .strict();
export const recordSchema = z
  .object({
    conversationId: z.uuid(),
    sdkSessionId: z.string().min(1),
    workspace: z.string(),
    nativeConfigDirectory: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type SavedConversation = z.infer<typeof recordSchema>;
export function isWithin(parent: string, candidate: string) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return (
    relative === '' ||
    (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
  );
}
export async function saveConversation(directory: string, value: unknown) {
  const record = recordSchema.parse(value);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, record.conversationId + '.json'),
    JSON.stringify(record, null, 2),
    { flag: 'wx' },
  );
  return record;
}
export async function loadConversation(directory: string, id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new Error('Invalid application conversation identifier.');
  const record = recordSchema.parse(
    JSON.parse(await readFile(path.join(directory, id + '.json'), 'utf8')),
  );
  if (record.conversationId !== id)
    throw new Error('Saved application identity does not match the requested record.');
  const ownedRuns = path.dirname(path.resolve(directory));
  if (
    !isWithin(ownedRuns, record.workspace) ||
    !isWithin(record.workspace, record.nativeConfigDirectory)
  )
    throw new Error('Saved session location is outside the owned classroom workspace.');
  return record;
}
