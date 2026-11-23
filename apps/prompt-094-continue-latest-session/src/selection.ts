import { z } from 'zod';
export const requestSchema = z
  .object({ mode: z.enum(['shared', 'isolated']), topic: z.enum(['MCP', 'Hooks']) })
  .strict();
