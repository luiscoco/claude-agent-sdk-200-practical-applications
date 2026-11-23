import { z } from 'zod';

export const requestSchema = z
  .object({
    mode: z.enum(['selected', 'unapproved', 'preapproved', 'denied']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export type Request = z.infer<typeof requestSchema>;

export function toolConfiguration(mode: Request['mode']) {
  return {
    tools: mode === 'selected' ? ['Read'] : ['Read', 'Write'],
    allowedTools: mode === 'preapproved' ? ['Write'] : [],
    disallowedTools: mode === 'denied' ? ['Write'] : [],
  };
}

export function expectedWriteStatus(mode: Request['mode']) {
  if (mode === 'preapproved') return 'completed';
  if (mode === 'unapproved') return 'permission-denied';
  return 'unavailable';
}

export function classroomText(topic: Request['topic']) {
  return `Synthetic classroom note about ${topic}.\n`;
}

export const outputSchema = z
  .object({
    readStatus: z.literal('completed'),
    readText: z.string(),
    writeStatus: z.enum(['completed', 'permission-denied', 'unavailable']),
  })
  .strict();
