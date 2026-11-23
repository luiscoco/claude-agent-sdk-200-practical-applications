import { z } from 'zod';
export const requestSchema = z
  .object({ mode: z.enum(['resume', 'fresh']), topic: z.enum(['MCP', 'Hooks']) })
  .strict();
export const requirementNames = [
  'OWNED_WORKSPACE',
  'RECORD_EVIDENCE',
  'STRUCTURED_RESULT',
  'LIMIT_TURNS',
] as const;
export const answerSchema = z
  .object({
    contextAvailable: z.boolean(),
    marker: z
      .string()
      .regex(/^FOLLOWUP_[A-F0-9]{8}$/)
      .nullable(),
    topic: z.enum(['MCP', 'Hooks']).nullable(),
    requirements: z.array(z.enum(requirementNames)).max(4),
    nextStep: z.string().max(180),
  })
  .strict();
export function sameRequirements(actual: string[], expected: string[]) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}
