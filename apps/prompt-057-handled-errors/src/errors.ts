import { createHash, randomUUID } from 'node:crypto';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const inputShape = { scenario: z.enum(['success', 'unavailable', 'missing', 'unexpected']) };
export const requestSchema = z.object(inputShape).strict();
export const outcomeSchema = z
  .object({
    ok: z.boolean(),
    orderId: z.string().nullable(),
    status: z.literal('ready').nullable(),
    errorCode: z.enum(['', 'SERVICE_UNAVAILABLE', 'ORDER_NOT_FOUND', 'REQUEST_FAILED']),
    message: z.string(),
    recovery: z.string(),
    retryable: z.boolean(),
    reference: z.string().uuid(),
  })
  .strict();
export class ClassroomServiceError extends Error {
  constructor(
    public readonly code: 'unavailable' | 'missing',
    message: string,
  ) {
    super(message);
  }
}
export function safeFailure(error: unknown, reference: string): z.infer<typeof outcomeSchema> {
  if (error instanceof ClassroomServiceError && error.code === 'unavailable') {
    return {
      ok: false,
      orderId: null,
      status: null,
      errorCode: 'SERVICE_UNAVAILABLE',
      message: 'The classroom order service is temporarily unavailable.',
      recovery:
        'Retry the request after service recovery. Keep this reference if assistance is needed.',
      retryable: true,
      reference,
    };
  }
  if (error instanceof ClassroomServiceError && error.code === 'missing') {
    return {
      ok: false,
      orderId: null,
      status: null,
      errorCode: 'ORDER_NOT_FOUND',
      message: 'The classroom order was not found.',
      recovery: 'Check the classroom order identifier before retrying.',
      retryable: false,
      reference,
    };
  }
  return {
    ok: false,
    orderId: null,
    status: null,
    errorCode: 'REQUEST_FAILED',
    message: 'The classroom request could not be completed.',
    recovery: 'Use this reference when requesting assistance.',
    retryable: false,
    reference,
  };
}

async function classroomRead(scenario: z.infer<typeof requestSchema>['scenario'], canary: string) {
  if (scenario === 'success') return { orderId: 'ORDER-101', status: 'ready' as const };
  const internalMessage =
    'Synthetic credential ' +
    canary +
    ' at http://classroom-internal.invalid/private. Internal stack ClassroomInternalStore.fetchRecord.';
  if (scenario === 'unexpected') throw new Error(internalMessage);
  throw new ClassroomServiceError(scenario, internalMessage);
}
export type Execution = {
  input: z.infer<typeof requestSchema>;
  outcome: z.infer<typeof outcomeSchema>;
  processId: number;
  causeObserved: boolean;
  causeFingerprint: string | null;
};

export function createErrorServer(executions: Execution[], canary: string) {
  const readOrder = tool(
    'read_order',
    'Read a local classroom order through the selected fixture scenario. Preserve the actual returned public error code, recovery guidance, retryability and reference.',
    inputShape,
    async (args) => {
      const input = requestSchema.parse(args);
      const reference = randomUUID();
      let outcome: z.infer<typeof outcomeSchema>;
      let causeObserved = false;
      let causeFingerprint: string | null = null;
      try {
        const order = await classroomRead(input.scenario, canary);
        outcome = {
          ok: true,
          ...order,
          errorCode: '',
          message: 'Local classroom order retrieved.',
          recovery: '',
          retryable: false,
          reference,
        };
      } catch (error) {
        causeObserved = true;
        const privateMessage = error instanceof Error ? error.message : String(error);
        causeFingerprint = createHash('sha256').update(privateMessage).digest('hex');
        outcome = safeFailure(error, reference);
      }
      executions.push({ input, outcome, processId: process.pid, causeObserved, causeFingerprint });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
        isError: !outcome.ok,
      };
    },
    { annotations: { readOnlyHint: true, destructiveHint: false } },
  );
  return createSdkMcpServer({ name: 'orders', version: '1.0.0', tools: [readOrder] });
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
