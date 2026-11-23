import { z } from 'zod';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

export const CountSchema = z.strictObject({ count: z.number().int().min(0).max(10) });
export type CountData = z.infer<typeof CountSchema>;
export const validSchema = z.toJSONSchema(CountSchema, { target: 'draft-7' });
// This valid JSON Schema deliberately has no satisfiable count value.
export const impossibleSchema = {
  type: 'object',
  properties: { count: { type: 'integer', minimum: 1, maximum: 0 } },
  required: ['count'],
  additionalProperties: false,
};

export function inspectResult(message: SDKResultMessage | null) {
  if (!message) return { kind: 'no_result' as const, data: null, errors: [] as string[] };
  if (message.subtype === 'error_max_structured_output_retries')
    return { kind: 'retry_exhausted' as const, data: null, errors: message.errors };
  if (message.subtype !== 'success')
    return { kind: 'native_error' as const, data: null, errors: message.errors };
  if (message.is_error)
    return { kind: 'native_error' as const, data: null, errors: [message.result] };
  if (message.structured_output === undefined || message.structured_output === null)
    return {
      kind: 'missing_output' as const,
      data: null,
      errors: ['No structured_output on the successful result.'],
    };
  const parsed = CountSchema.safeParse(message.structured_output);
  if (!parsed.success)
    return {
      kind: 'invalid_data' as const,
      data: null,
      errors: parsed.error.issues.map((issue) => issue.path.join('.') + ' · ' + issue.message),
    };
  return { kind: 'ready' as const, data: parsed.data, errors: [] as string[] };
}
export function consumeCount(data: CountData) {
  return { count: data.count, countPlusOne: data.count + 1 };
}
