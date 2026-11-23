import { z } from 'zod';

export const requestSchema = z
  .object({
    mode: z.enum(['deny-wins', 'ask-denied', 'ask-approved', 'allow-only']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export type Request = z.infer<typeof requestSchema>;
export const rule = 'Read(./classroom-note.txt)';

export function permissionRules(mode: Request['mode']) {
  return {
    allow: [rule],
    ask: mode === 'allow-only' ? [] : [rule],
    deny: mode === 'deny-wins' ? [rule] : [],
  };
}
export function expectedStatus(mode: Request['mode']) {
  return ['ask-approved', 'allow-only'].includes(mode) ? 'completed' : 'permission-denied';
}
export function classroomText(topic: Request['topic']) {
  return `Synthetic classroom note about ${topic}.\n`;
}
export const outputSchema = z
  .object({
    status: z.enum(['completed', 'permission-denied']),
    text: z.string().nullable(),
  })
  .strict();
