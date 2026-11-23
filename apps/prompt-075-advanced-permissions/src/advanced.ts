import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['auto', 'bypass', 'auto-ask', 'bypass-ask']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export type Request = z.infer<typeof requestSchema>;
export function toolConfiguration(mode: Request['mode']) {
  const bypass = mode === 'bypass' || mode === 'bypass-ask';
  return {
    tools: ['Read', 'Write'],
    allowedTools: [],
    permissionMode: bypass ? ('bypassPermissions' as const) : ('auto' as const),
    allowDangerouslySkipPermissions: bypass,
    settings: {
      permissions: {
        ask: mode.endsWith('-ask') ? ['Edit(./classroom-report.txt)'] : [],
        blockReadsOutsideWorkingDirectories: true,
        blockWritesOutsideWorkingDirectories: true,
      },
    },
  };
}
export function expectedWriteStatus(mode: Request['mode']) {
  return mode.endsWith('-ask') ? 'permission-denied' : 'completed';
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
