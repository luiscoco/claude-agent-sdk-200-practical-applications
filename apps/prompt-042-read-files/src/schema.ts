import { z } from 'zod';
export const SourceSummarySchema = z.strictObject({
  summary: z.string().min(1).max(900),
  sections: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        startLine: z.number().int().min(1),
        endLine: z.number().int().min(1),
        explanation: z.string().min(1).max(240),
      }),
    )
    .max(3),
  readError: z.string(),
});
export const jsonSchema = z.toJSONSchema(SourceSummarySchema, { target: 'draft-7' });
export function validateSections(
  sections: z.infer<typeof SourceSummarySchema>['sections'],
  lines: string[],
  expectedFunction: string,
) {
  const expectedLine =
    lines.findIndex((line) => line.includes('export function ' + expectedFunction + '(')) + 1;
  return (
    expectedLine > 0 &&
    sections.length > 0 &&
    sections.every(
      (section) =>
        section.startLine >= 1 &&
        section.startLine <= section.endLine &&
        section.endLine <= lines.length,
    ) &&
    sections.some(
      (section) =>
        section.name.includes(expectedFunction) &&
        section.startLine <= expectedLine &&
        section.endLine >= expectedLine,
    )
  );
}
