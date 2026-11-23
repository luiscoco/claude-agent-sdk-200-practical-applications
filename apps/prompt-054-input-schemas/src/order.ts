import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const toolInputShape = {
  customer: z.object({ name: z.string() }).strict(),
  address: z
    .object({ city: z.string(), postalCode: z.string(), country: z.literal('ES').optional() })
    .strict(),
  items: z.array(z.object({ sku: z.enum(['MIC-101', 'CAB-202']), quantity: z.number() }).strict()),
  options: z
    .object({
      shipping: z.enum(['standard', 'express']).optional(),
      giftWrap: z.boolean().optional(),
    })
    .strict()
    .optional(),
};
export const requestSchema = z.object(toolInputShape).strict();
export const validatedOrder = z
  .object({
    customer: z.object({ name: z.string().trim().min(1).max(80) }).strict(),
    address: z
      .object({
        city: z.string().trim().min(1).max(80),
        postalCode: z.string().regex(/^\d{5}$/, 'Use five digits for the Spanish postal code.'),
        country: z.literal('ES').default('ES'),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            sku: z.enum(['MIC-101', 'CAB-202']),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    options: z
      .object({
        shipping: z.enum(['standard', 'express']).default('standard'),
        giftWrap: z.boolean().default(false),
      })
      .strict()
      .default({ shipping: 'standard', giftWrap: false }),
  })
  .strict();
const normalizedSchema = z
  .object({
    customer: z.object({ name: z.string() }).strict(),
    address: z
      .object({ city: z.string(), postalCode: z.string(), country: z.literal('ES') })
      .strict(),
    items: z.array(
      z.object({ sku: z.enum(['MIC-101', 'CAB-202']), quantity: z.number().int() }).strict(),
    ),
    options: z
      .object({ shipping: z.enum(['standard', 'express']), giftWrap: z.boolean() })
      .strict(),
  })
  .strict();
export const outcomeSchema = z
  .object({
    ok: z.boolean(),
    normalized: normalizedSchema.nullable(),
    totalCents: z.number().int().nullable(),
    errorCode: z.enum(['', 'INVALID_ARGUMENTS']),
    issues: z.array(z.string()),
  })
  .strict();
export type Execution = {
  input: unknown;
  outcome: z.infer<typeof outcomeSchema>;
  processId: number;
};
export const defaultInput = {
  customer: { name: 'Classroom learner' },
  address: { city: 'Madrid', postalCode: '28001' },
  items: [{ sku: 'CAB-202', quantity: 2 }],
};

export function evaluateOrder(args: unknown): z.infer<typeof outcomeSchema> {
  const parsed = validatedOrder.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      normalized: null,
      totalCents: null,
      errorCode: 'INVALID_ARGUMENTS',
      issues: parsed.error.issues.map((issue) => issue.path.join('.') + ' · ' + issue.message),
    };
  }
  const normalized = parsed.data;
  const prices = { 'MIC-101': 7900, 'CAB-202': 1200 };
  const subtotal = normalized.items.reduce(
    (sum, item) => sum + prices[item.sku] * item.quantity,
    0,
  );
  const shipping = normalized.options.shipping === 'express' ? 890 : 490;
  const giftWrap = normalized.options.giftWrap ? 200 : 0;
  return {
    ok: true,
    normalized,
    totalCents: subtotal + shipping + giftWrap,
    errorCode: '',
    issues: [],
  };
}

export function createOrderServer(executions: Execution[]) {
  const quote = tool(
    'quote_order',
    'Validate a nested classroom order, apply optional-field defaults in the handler and return a local euro-cent quote or useful argument errors.',
    toolInputShape,
    async (args) => {
      const outcome = evaluateOrder(args);
      executions.push({ input: structuredClone(args), outcome, processId: process.pid });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
        isError: !outcome.ok,
      };
    },
    { annotations: { readOnlyHint: true, destructiveHint: false } },
  );
  return createSdkMcpServer({ name: 'orders', version: '1.0.0', tools: [quote] });
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
