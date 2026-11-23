import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['plan', 'accept-edits', 'edits-denied']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export type Request = z.infer<typeof requestSchema>;
export function configuration(mode: Request['mode']) {
  return {
    permissionMode: mode === 'plan' ? ('plan' as const) : ('acceptEdits' as const),
    tools: ['Read', 'Edit', 'Write'],
    settings: {
      permissions: { deny: mode === 'edits-denied' ? ['Edit(./lesson-title.txt)'] : [] },
    },
  };
}
export function fixture(topic: Request['topic']) {
  return { original: `Draft ${topic} lesson.\n`, proposed: `Reviewed ${topic} lesson.\n` };
}
export const outputSchema = z
  .object({
    status: z.enum(['planned', 'applied', 'permission-denied']),
    proposedText: z.string(),
  })
  .strict();
