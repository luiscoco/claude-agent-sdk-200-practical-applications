import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['switch', 'deny-switch', 'compact', 'combined']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export const initialModel = 'claude-sonnet-4-6';
export const targetModel = 'claude-haiku-4-5';
export function modelMatches(actual: string, requested: string) {
  return (
    actual === requested ||
    new RegExp('^' + requested.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-\\d{8}$').test(actual)
  );
}
