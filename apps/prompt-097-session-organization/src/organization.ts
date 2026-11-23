import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['organize', 'replace', 'clear']),
    title: z.string().trim().min(1).max(90),
    tag: z.enum(['ready', 'review']),
  })
  .strict();
