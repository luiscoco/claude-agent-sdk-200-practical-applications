import { z } from 'zod';

export const toolInputSchema = z.object({ slug: z.string().min(1).max(80) }).strict();
export const requestSchema = toolInputSchema;
export const outcomeSchema = z
  .object({
    ok: z.boolean(),
    slug: z.string(),
    lesson: z
      .object({ title: z.string(), minutes: z.number().int(), topics: z.array(z.string()) })
      .nullable(),
    errorCode: z.enum(['', 'LESSON_NOT_FOUND']),
    processId: z.number().int(),
    transport: z.literal('stdio'),
  })
  .strict();
export function nativeOutcome(content: unknown) {
  const blocks =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((block) => block?.type === 'text').map((block) => block.text)
        : [];
  for (const text of blocks) {
    try {
      const parsed = outcomeSchema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {}
  }
  return null;
}
