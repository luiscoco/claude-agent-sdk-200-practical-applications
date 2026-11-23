import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['reader', 'auditor', 'filtered-auditor']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export const outputSchema = z
  .object({
    status: z.literal('completed'),
    helper: z.enum(['note-reader', 'note-auditor']),
    text: z.string(),
  })
  .strict();
export function correlated(
  start: { task_id: string; tool_use_id?: string },
  parentId: string,
  read: { agentId: string | null; parentId: string | null },
) {
  return Boolean(
    start.task_id &&
    start.tool_use_id === parentId &&
    read.parentId === parentId &&
    read.agentId === start.task_id,
  );
}
