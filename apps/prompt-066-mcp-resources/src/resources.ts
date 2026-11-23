import { z } from 'zod';
export const requestSchema = z
  .object({ uri: z.string().regex(/^course:\/\/lessons\/[a-z0-9-]{1,60}$/) })
  .strict();
export const resourceBodySchema = z
  .object({
    title: z.string(),
    paragraph: z.string(),
    segments: z.array(z.number().int().min(0).max(60)).min(1).max(10),
  })
  .strict();
export const fixtureSchema = z.array(
  resourceBodySchema.extend({
    uri: z.string(),
    name: z.string(),
    mimeType: z.literal('application/json'),
  }),
);
export const outputSchema = z
  .object({
    ok: z.boolean(),
    uri: z.string(),
    title: z.string().nullable(),
    paragraph: z.string().nullable(),
    segments: z.array(z.number().int()),
    totalMinutes: z.number().int().nullable(),
    errorCode: z.enum(['', 'RESOURCE_NOT_FOUND']),
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
