import { z } from 'zod';

export const WorkshopSchema = z.strictObject({
  title: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(120),
  prerequisites: z.array(z.string().min(1)).min(1),
  published: z.boolean(),
});
export type Workshop = z.infer<typeof WorkshopSchema>;
export const jsonSchema = z.toJSONSchema(WorkshopSchema, { target: 'draft-7' });

export function consumeWorkshop(workshop: Workshop) {
  return {
    title: workshop.title,
    totalMinutesWithBreak: workshop.durationMinutes + 5,
    prerequisiteText: workshop.prerequisites.join(' → '),
    publicationLabel: workshop.published ? 'Published' : 'Draft',
  };
}

export function corruptDuration(value: unknown) {
  if (value && typeof value === 'object' && 'durationMinutes' in value)
    return { ...value, durationMinutes: String(value.durationMinutes) };
  return value;
}
