import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['complete', 'repair-completion', 'guard-limit', 'reject-prompt']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export function promptAdmission(prompt: string) {
  return /^Course topic: (MCP|Hooks)\./.test(prompt);
}
export function stopPolicy(active: boolean, completionSatisfied: boolean) {
  if (active) return 'guard-release' as const;
  return completionSatisfied ? ('complete' as const) : ('request-repair' as const);
}
