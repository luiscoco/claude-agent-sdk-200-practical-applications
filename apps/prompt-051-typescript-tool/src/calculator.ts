import { randomUUID } from 'node:crypto';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const calculatorShape = {
  operation: z
    .enum(['add', 'subtract', 'multiply', 'divide'])
    .describe('The arithmetic operation.'),
  left: z.number().finite().min(-1000000).max(1000000).describe('The left operand.'),
  right: z.number().finite().min(-1000000).max(1000000).describe('The right operand.'),
};
export const calculatorInput = z.strictObject(calculatorShape);
export type CalculatorInput = z.infer<typeof calculatorInput>;
export function sameCalculation(first: CalculatorInput, second: CalculatorInput) {
  return (
    first.operation === second.operation &&
    first.left === second.left &&
    first.right === second.right
  );
}
export const outcomeSchema = z.strictObject({
  ok: z.boolean(),
  result: z.number().finite().nullable(),
  errorCode: z.enum(['', 'DIVISION_BY_ZERO', 'NON_FINITE_RESULT']),
});
export type Outcome = z.infer<typeof outcomeSchema>;
export type Execution = {
  id: string;
  input: CalculatorInput;
  outcome: Outcome;
  processId: number;
  executedAt: string;
};

export function calculate(input: CalculatorInput): Outcome {
  if (input.operation === 'divide' && input.right === 0)
    return { ok: false, result: null, errorCode: 'DIVISION_BY_ZERO' };
  let result: number;
  switch (input.operation) {
    case 'add':
      result = input.left + input.right;
      break;
    case 'subtract':
      result = input.left - input.right;
      break;
    case 'multiply':
      result = input.left * input.right;
      break;
    case 'divide':
      result = input.left / input.right;
      break;
  }
  if (!Number.isFinite(result)) return { ok: false, result: null, errorCode: 'NON_FINITE_RESULT' };
  return { ok: true, result: Object.is(result, -0) ? 0 : result, errorCode: '' };
}

export function nativeOutcome(content: unknown) {
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .filter((block) => block?.type === 'text' && typeof block.text === 'string')
            .map((block) => block.text)
            .join('\n')
        : '';
  try {
    const parsed = outcomeSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function createCalculatorServer(executions: Execution[]) {
  const calculator = tool(
    'calculate',
    'Calculate an arithmetic result from the operation and two finite operands. Preserve division-by-zero errors.',
    calculatorShape,
    async (args) => {
      const outcome = calculate(args);
      executions.push({
        id: randomUUID(),
        input: { ...args },
        outcome,
        processId: process.pid,
        executedAt: new Date().toISOString(),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
        isError: !outcome.ok,
      };
    },
    { annotations: { readOnlyHint: true, destructiveHint: false } },
  );
  return createSdkMcpServer({ name: 'calculator', version: '1.0.0', tools: [calculator] });
}
