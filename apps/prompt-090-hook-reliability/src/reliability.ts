import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum([
      'matcher-miss',
      'deny',
      'throw-open',
      'throw-closed',
      'timeout-closed',
      'async-audit',
    ]),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export function waitForCallback(
  signal: AbortSignal,
  milliseconds: number,
  onCancelled: () => void,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      onCancelled();
      reject(new Error('CLASSROOM_CALLBACK_CANCELLED'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    function cancel() {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      onCancelled();
      reject(new Error('CLASSROOM_CALLBACK_CANCELLED'));
    }
    signal.addEventListener('abort', cancel, { once: true });
  });
}
