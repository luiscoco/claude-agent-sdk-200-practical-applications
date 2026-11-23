import type { CoursePlan } from './schema.js';

export function preparePlan(mode: unknown) {
  if (
    typeof mode !== 'string' ||
    !['with-optionals', 'without-optionals', 'missing-name', 'invalid-enum'].includes(mode)
  )
    throw new Error('INVALID_MODE · Select one of the complex-result scenarios.');
  const expected: CoursePlan = {
    title: 'Streaming Sprint',
    audience: 'intermediate',
    owner: { name: 'Luis Coco Enríquez' },
    lessons: [
      { title: 'Stream text', minutes: 20, tags: ['code', 'demo'] },
      { title: 'Practice streaming', minutes: 15, tags: ['exercise'] },
    ],
  };
  const optionalFacts = [];
  if (mode !== 'without-optionals') {
    expected.owner.timezone = 'Europe/Madrid';
    expected.notes = 'Bring the runnable lab.';
    optionalFacts.push('Owner timezone: Europe/Madrid', 'Notes: Bring the runnable lab.');
  }
  const sourceText = [
    'Course: Streaming Sprint',
    'Audience: intermediate',
    'Owner name: Luis Coco Enríquez',
    'Lesson 1: Stream text; 20 minutes; tags code, demo',
    'Lesson 2: Practice streaming; 15 minutes; tag exercise',
    ...optionalFacts,
  ].join('\n');
  return { mode, sourceText, expected };
}
