import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['baseline', 'sanitize', 'invalid-shape', 'replace']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export const outputSchema = z.object({ status: z.literal('completed'), text: z.string() }).strict();
export function sanitizeText(text: string) {
  return text
    .replace(/\bstudent-[a-z0-9]+@example\.invalid\b/gi, '[REDACTED_EMAIL]')
    .replace(/\bCLASSROOM_TOKEN_[A-Z0-9_]+\b/g, '[REDACTED_TOKEN]');
}
export function replaceReadContent(response: unknown, content: string) {
  const parsed = z
    .object({
      type: z.literal('text'),
      file: z
        .object({
          content: z.string(),
          filePath: z.string(),
          numLines: z.number(),
          startLine: z.number(),
          totalLines: z.number(),
        })
        .passthrough(),
    })
    .passthrough()
    .parse(response);
  const lines = content.split('\n').length;
  return {
    ...parsed,
    file: { ...parsed.file, content, numLines: lines, totalLines: lines, startLine: 1 },
  };
}
