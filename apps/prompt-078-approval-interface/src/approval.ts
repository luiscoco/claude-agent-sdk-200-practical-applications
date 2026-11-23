import { z } from 'zod';
export const requestSchema = z.object({ topic: z.enum(['MCP', 'Hooks']) }).strict();
export const outputSchema = z
  .object({
    status: z.enum(['completed', 'permission-denied']),
    text: z.string().nullable(),
  })
  .strict();
