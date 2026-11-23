import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['success', 'returned-error', 'thrown-error', 'permission-denied']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export const outputSchema = z
  .object({
    status: z.enum(['completed', 'tool-failed', 'permission-denied']),
    errorCode: z.string().nullable(),
    text: z.string().nullable(),
  })
  .strict();
export const nativeToolName = 'mcp__classroom__lookup_note';
export function diagnosticFor(error: string, interrupted = false) {
  if (interrupted)
    return {
      code: 'INTERRUPTED',
      retryable: false,
      nextStep: 'Respect cancellation; wait for a new explicit classroom run.',
    };
  if (error.includes('CLASSROOM_NOT_FOUND'))
    return {
      code: 'CLASSROOM_NOT_FOUND',
      retryable: false,
      nextStep: 'Restore the owned fixture before a fresh lookup.',
    };
  if (error.includes('CLASSROOM_STORE_OFFLINE'))
    return {
      code: 'CLASSROOM_STORE_OFFLINE',
      retryable: true,
      nextStep: 'Restore the owned classroom store, then start one fresh lookup.',
    };
  return {
    code: 'UNCLASSIFIED_TOOL_FAILURE',
    retryable: false,
    nextStep: 'Inspect the observed error before selecting recovery.',
  };
}
