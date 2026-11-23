import { z } from 'zod';
export const requestSchema = z
  .object({
    topic: z.enum(['MCP', 'Hooks']),
    style: z.enum(['single', 'multiple']),
  })
  .strict();
export const nativeQuestionSchema = z
  .object({
    questions: z
      .array(
        z
          .object({
            question: z.string().min(1),
            header: z.string(),
            options: z
              .array(z.object({ label: z.string().min(1), description: z.string() }).passthrough())
              .min(2)
              .max(4),
            multiSelect: z.boolean(),
          })
          .passthrough(),
      )
      .length(1),
  })
  .passthrough();
export const answerSchema = z.discriminatedUnion('action', [
  z
    .object({ action: z.literal('select'), labels: z.array(z.string().min(1)).min(1).max(4) })
    .strict(),
  z.object({ action: z.literal('text'), text: z.string().min(1).max(1000) }).strict(),
]);
export type Answer = z.infer<typeof answerSchema>;
export function validateAnswer(input: unknown, value: unknown) {
  const question = nativeQuestionSchema.parse(input).questions[0];
  const answer = answerSchema.parse(value);
  if (answer.action === 'select') {
    if (
      (!question.multiSelect && answer.labels.length !== 1) ||
      new Set(answer.labels).size !== answer.labels.length ||
      answer.labels.some((label) => !question.options.some((option) => option.label === label))
    ) {
      throw new Error(
        'Select distinct labels from the actual question, respecting its selection mode.',
      );
    }
  }
  return answer;
}
export function responseText(answer: Answer) {
  return answer.action === 'text' ? answer.text : answer.labels.join(', ');
}
export const outputSchema = z.object({ question: z.string(), answer: z.string() }).strict();
