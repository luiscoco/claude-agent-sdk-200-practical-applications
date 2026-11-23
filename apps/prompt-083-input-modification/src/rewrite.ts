import path from 'node:path';
import { z } from 'zod';

export const requestSchema = z
  .object({
    mode: z.enum(['original', 'rewrite-path', 'rewrite-content', 'rewrite-both']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export const outputSchema = z
  .object({
    status: z.literal('completed'),
    file: z.string(),
    text: z.string(),
  })
  .strict();
export function rewriteWrite<
  T extends Record<string, unknown> & { file_path: string; content: string },
>(input: T, mode: z.infer<typeof requestSchema>['mode'], workspace: string, topic: string) {
  return {
    ...input,
    ...(['rewrite-path', 'rewrite-both'].includes(mode)
      ? { file_path: path.join(workspace, 'rewritten-note.txt') }
      : {}),
    ...(['rewrite-content', 'rewrite-both'].includes(mode)
      ? { content: `Reviewed ${topic} classroom note.\n` }
      : {}),
  };
}
