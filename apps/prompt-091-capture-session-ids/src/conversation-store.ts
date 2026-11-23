import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
export const requestSchema = z
  .object({ mode: z.enum(['single', 'pair']), topic: z.enum(['MCP', 'Hooks']) })
  .strict();
export const conversationSchema = z
  .object({
    conversationId: z.uuid(),
    label: z.string(),
    topic: z.enum(['MCP', 'Hooks']),
    sdkSessionId: z.string().min(1),
    workspace: z.string(),
    nativeConfigDirectory: z.string(),
    summary: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type Conversation = z.infer<typeof conversationSchema>;
export async function insertConversation(directory: string, value: unknown) {
  const record = conversationSchema.parse(value);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, record.conversationId + '.json'),
    JSON.stringify(record, null, 2),
    { flag: 'wx' },
  );
  return record;
}
export async function readConversation(directory: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  try {
    return conversationSchema.parse(
      JSON.parse(await readFile(path.join(directory, id + '.json'), 'utf8')),
    );
  } catch (failure) {
    if ((failure as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw failure;
  }
}
