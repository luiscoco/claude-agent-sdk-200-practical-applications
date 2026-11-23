import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const requestSchema = z
  .object({ descriptionMode: z.enum(['vague', 'specific']), suite: z.enum(['core', 'holdout']) })
  .strict();
export const resultSchema = z
  .object({ source: z.enum(['invoice', 'policy']), facts: z.array(z.string()) })
  .strict();
export const toolNames = {
  invoice: 'mcp__records__lookup_record_a',
  policy: 'mcp__records__lookup_record_b',
};
export const descriptions = {
  vague: {
    invoice: 'Retrieve a matching classroom record.',
    policy: 'Retrieve a matching classroom record.',
  },
  specific: {
    invoice:
      'Retrieve financial facts for the specific classroom invoice INV-101. Use for its charged amount, payment status or invoice identifier. General booking cancellation rules belong to the other record tool.',
    policy:
      'Retrieve the general classroom booking cancellation policy. Use for cancellation windows, eligibility and rules before a session starts. Specific invoice amounts and payment status belong to the other record tool.',
  },
};
export const testCases = {
  core: [
    {
      id: 'invoice-amount',
      question: 'How much was charged on classroom invoice INV-101?',
      expected: 'invoice',
    },
    {
      id: 'policy-window',
      question: 'What is the general cancellation window for a classroom booking?',
      expected: 'policy',
    },
    {
      id: 'invoice-status',
      question: 'Has classroom invoice INV-101 been paid?',
      expected: 'invoice',
    },
    {
      id: 'policy-eligibility',
      question: 'What is the general rule for cancelling before a classroom session starts?',
      expected: 'policy',
    },
  ],
  holdout: [
    {
      id: 'new-invoice',
      question: 'Show the payment details recorded for INV-101.',
      expected: 'invoice',
    },
    {
      id: 'new-policy',
      question: 'Explain the standing cancellation rules for future classroom bookings.',
      expected: 'policy',
    },
  ],
} as const;
export type Case = (typeof testCases.core)[number] | (typeof testCases.holdout)[number];
export type DescriptionMode = keyof typeof descriptions;
export type Execution = {
  source: 'invoice' | 'policy';
  query: string;
  outcome: z.infer<typeof resultSchema>;
  processId: number;
};

export function createRecordServer(mode: DescriptionMode, executions: Execution[]) {
  const lookupShape = { query: z.string() };
  const invoice = tool(
    'lookup_record_a',
    descriptions[mode].invoice,
    lookupShape,
    async (args) => {
      const outcome = {
        source: 'invoice' as const,
        facts: ['Classroom invoice INV-101 charged 79.00 EUR.', 'Payment status is paid.'],
      };
      executions.push({ source: 'invoice', query: args.query, outcome, processId: process.pid });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
      };
    },
    { annotations: { readOnlyHint: true, destructiveHint: false } },
  );
  const policy = tool(
    'lookup_record_b',
    descriptions[mode].policy,
    lookupShape,
    async (args) => {
      const outcome = {
        source: 'policy' as const,
        facts: [
          'The classroom fixture cancellation window is 14 days.',
          'Cancellation is eligible before the classroom session starts.',
        ],
      };
      executions.push({ source: 'policy', query: args.query, outcome, processId: process.pid });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
      };
    },
    { annotations: { readOnlyHint: true, destructiveHint: false } },
  );
  return createSdkMcpServer({ name: 'records', version: '1.0.0', tools: [invoice, policy] });
}

export function nativeObject(content: unknown) {
  let text = '';
  if (typeof content === 'string') text = content;
  if (Array.isArray(content))
    text = content
      .filter((block) => block?.type === 'text')
      .map((block) => block.text)
      .join('\n');
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
