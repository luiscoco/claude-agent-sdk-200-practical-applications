import { z } from 'zod';
export const requestSchema = z
  .object({ mode: z.enum(['first', 'second', 'full']), topic: z.enum(['MCP', 'Hooks']) })
  .strict();
