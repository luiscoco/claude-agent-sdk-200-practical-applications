import { z } from 'zod';

export const CoursePlanSchema = z.strictObject({
  title: z.string().min(1),
  audience: z.enum(['beginner', 'intermediate']),
  owner: z.strictObject({ name: z.string().min(1), timezone: z.string().optional() }),
  lessons: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        minutes: z.number().int().min(1).max(120),
        tags: z.array(z.enum(['code', 'demo', 'exercise'])),
      }),
    )
    .min(1),
  notes: z.string().optional(),
});
export type CoursePlan = z.infer<typeof CoursePlanSchema>;
export const jsonSchema = z.toJSONSchema(CoursePlanSchema, { target: 'draft-7' });

export function consumePlan(plan: CoursePlan) {
  return {
    title: plan.title,
    audience: plan.audience,
    ownerName: plan.owner.name,
    lessonCount: plan.lessons.length,
    totalMinutes: plan.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
    timezoneDisplay: plan.owner.timezone ?? 'Unspecified',
    notesDisplay: plan.notes ?? 'No notes supplied',
    ownerTimezonePresent: Object.hasOwn(plan.owner, 'timezone'),
    notesPresent: Object.hasOwn(plan, 'notes'),
  };
}

export function boundaryCandidate(value: unknown, mode: string) {
  if (!value || typeof value !== 'object') return value;
  if (mode === 'invalid-enum') return { ...value, audience: 'expert' };
  if (
    mode === 'missing-name' &&
    'owner' in value &&
    value.owner &&
    typeof value.owner === 'object'
  ) {
    const owner: Record<string, unknown> = { ...value.owner };
    delete owner.name;
    return { ...value, owner };
  }
  return value;
}
