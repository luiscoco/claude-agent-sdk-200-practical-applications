import { z } from 'zod';

export const requestSchema = z
  .object({
    mode: z.enum(['default-allow', 'default-deny', 'dont-ask', 'preapproved']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export type Request = z.infer<typeof requestSchema>;
export function toolConfiguration(mode: Request['mode']) {
  return {
    tools: ['Read', 'Write'],
    allowedTools: mode === 'preapproved' ? ['Write'] : [],
    permissionMode:
      mode === 'dont-ask' || mode === 'preapproved' ? ('dontAsk' as const) : ('default' as const),
  };
}
export function expectedWriteStatus(mode: Request['mode']) {
  return mode === 'default-allow' || mode === 'preapproved' ? 'completed' : 'permission-denied';
}
export function classroomText(topic: Request['topic']) {
  return `Synthetic classroom note about ${topic}.\n`;
}
export const outputSchema = z
  .object({
    readStatus: z.literal('completed'),
    readText: z.string(),
    writeStatus: z.enum(['completed', 'permission-denied']),
  })
  .strict();
