import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['individual', 'server-wide', 'bad-prefix']),
    slug: z.enum(['local-mcp', 'agent-loop']),
  })
  .strict();
export type Mode = z.infer<typeof requestSchema>['mode'];
export const readTool = 'mcp__catalog__read_lesson',
  listTool = 'mcp__catalog__list_lessons';
export function permissionRules(mode: Mode) {
  if (mode === 'server-wide') return ['mcp__catalog__*'];
  if (mode === 'bad-prefix') return ['mcp__*'];
  return [readTool];
}
export const outputSchema = z
  .object({
    readStatus: z.enum(['completed', 'permission-denied']),
    lessonTitle: z.string().nullable(),
    listStatus: z.enum(['completed', 'permission-denied']),
    slugs: z.array(z.string()),
  })
  .strict();
export function decodedNative(content: unknown) {
  const texts =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((block) => block?.type === 'text').map((block) => String(block.text))
        : [];
  for (const text of texts) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return null;
}
