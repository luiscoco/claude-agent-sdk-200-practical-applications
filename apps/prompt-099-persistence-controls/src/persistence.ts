import { z } from 'zod';
export const requestSchema = z
  .object({ mode: z.enum(['typescript', 'python', 'compare']), topic: z.enum(['MCP', 'Hooks']) })
  .strict();
