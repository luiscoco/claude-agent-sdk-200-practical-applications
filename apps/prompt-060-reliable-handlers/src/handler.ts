import { randomUUID } from 'node:crypto';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const requestSchema = z
  .object({
    mode: z.enum(['retry-after-timeout', 'timeout', 'cancel', 'success']),
    label: z.string().min(1).max(120).default('Classroom booking'),
  })
  .strict();
export type Mode = z.infer<typeof requestSchema>['mode'];
export const scenarios = {
  'retry-after-timeout': {
    processingMs: 50,
    replyDelayMs: 2500,
    deadlines: [1000, 2000],
    calls: 2,
  },
  timeout: { processingMs: 1500, replyDelayMs: 0, deadlines: [250], calls: 1 },
  cancel: { processingMs: 5000, replyDelayMs: 0, deadlines: [12000], calls: 1 },
  success: { processingMs: 100, replyDelayMs: 0, deadlines: [2000], calls: 1 },
};
export const toolInputShape = { requestKey: z.string().uuid(), label: z.string().min(1).max(120) };
export const toolInputSchema = z.object(toolInputShape).strict();
export const outcomeSchema = z
  .object({
    ok: z.boolean(),
    requestKey: z.string().uuid(),
    bookingId: z.string().nullable(),
    replayed: z.boolean(),
    errorCode: z.enum(['', 'TIMEOUT', 'CANCELLED', 'IDEMPOTENCY_CONFLICT', 'UPSTREAM_FAILED']),
  })
  .strict();
const apiReplySchema = z
  .object({
    bookingId: z.string(),
    requestKey: z.string().uuid(),
    label: z.string(),
    replayed: z.boolean(),
  })
  .strict();
export type OperationControl = {
  id: string;
  mode: Mode | null;
  phase: 'awaiting-tool' | 'connecting' | 'waiting' | 'between-calls' | 'settling' | 'finished';
  abort: AbortController;
  cancelRequested: boolean;
};
export function createOperationControl(): OperationControl {
  return {
    id: randomUUID(),
    mode: null,
    phase: 'awaiting-tool',
    abort: new AbortController(),
    cancelRequested: false,
  };
}
export function requestCancellation(control: OperationControl) {
  if (control.mode !== 'cancel' || control.phase !== 'waiting' || control.abort.signal.aborted)
    return false;
  control.cancelRequested = true;
  control.abort.abort(new Error('Classroom host cancellation requested.'));
  return true;
}
export type Execution = {
  attempt: number;
  input: z.infer<typeof toolInputSchema>;
  deadlineMs: number;
  elapsedMs: number;
  deadlineExpired: boolean;
  hostCancellationObserved: boolean;
  outcome: z.infer<typeof outcomeSchema>;
  processId: number;
};

export function createReliableServer(
  url: string,
  mode: Mode,
  control: OperationControl,
  executions: Execution[],
) {
  let attempt = 0;
  const createBooking = tool(
    'create_booking',
    'Create a synthetic classroom booking through the local HTTP API using the supplied idempotency key. Preserve actual timeout, cancellation, replay and booking outcomes.',
    toolInputShape,
    async (args) => {
      const input = toolInputSchema.parse(args);
      const currentAttempt = attempt++;
      const configuration = scenarios[mode];
      const deadlineMs =
        configuration.deadlines[Math.min(currentAttempt, configuration.deadlines.length - 1)];
      const deadline = AbortSignal.timeout(deadlineMs);
      const signal = AbortSignal.any([control.abort.signal, deadline]);
      const started = performance.now();
      control.phase = 'connecting';
      let outcome: z.infer<typeof outcomeSchema>;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.requestKey },
          body: JSON.stringify({ label: input.label }),
          signal,
        });
        if (!response.ok) {
          outcome = {
            ok: false,
            requestKey: input.requestKey,
            bookingId: null,
            replayed: false,
            errorCode: response.status === 409 ? 'IDEMPOTENCY_CONFLICT' : 'UPSTREAM_FAILED',
          };
        } else {
          const reply = apiReplySchema.parse(await response.json());
          if (reply.requestKey !== input.requestKey || reply.label !== input.label)
            throw new Error('Classroom response input mismatch.');
          outcome = {
            ok: true,
            requestKey: reply.requestKey,
            bookingId: reply.bookingId,
            replayed: reply.replayed,
            errorCode: '',
          };
        }
      } catch {
        const errorCode = control.abort.signal.aborted
          ? 'CANCELLED'
          : deadline.aborted
            ? 'TIMEOUT'
            : 'UPSTREAM_FAILED';
        outcome = {
          ok: false,
          requestKey: input.requestKey,
          bookingId: null,
          replayed: false,
          errorCode,
        };
      } finally {
        control.phase = 'between-calls';
      }
      executions.push({
        attempt: currentAttempt + 1,
        input,
        deadlineMs,
        elapsedMs: Math.round((performance.now() - started) * 100) / 100,
        deadlineExpired: deadline.aborted,
        hostCancellationObserved: control.abort.signal.aborted,
        outcome,
        processId: process.pid,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
        isError: !outcome.ok,
      };
    },
    {
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  );
  return createSdkMcpServer({ name: 'bookings', version: '1.0.0', tools: [createBooking] });
}
export function nativeOutcome(content: unknown) {
  let text = '';
  if (typeof content === 'string') text = content;
  if (Array.isArray(content))
    text = content
      .filter((block) => block?.type === 'text')
      .map((block) => block.text)
      .join('\n');
  try {
    const parsed = outcomeSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
