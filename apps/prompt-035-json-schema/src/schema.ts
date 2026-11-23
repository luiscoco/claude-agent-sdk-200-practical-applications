export const workshopSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    title: { type: 'string' },
    durationMinutes: { type: 'integer', minimum: 1, maximum: 120 },
    prerequisites: { type: 'array', items: { type: 'string' } },
    published: { type: 'boolean' },
  },
  required: ['title', 'durationMinutes', 'prerequisites', 'published'],
  additionalProperties: false,
};

export function prepareTask(value: unknown) {
  if (value !== 'basics' && value !== 'streaming')
    throw new Error('INVALID_TASK · Select a classroom workshop.');
  const expected =
    value === 'basics'
      ? {
          title: 'Agent SDK Basics',
          durationMinutes: 25,
          prerequisites: ['TypeScript', 'async/await'],
          published: false,
        }
      : {
          title: 'Streaming Lab',
          durationMinutes: 40,
          prerequisites: ['SDK query', 'Async generators'],
          published: true,
        };
  const sourceText =
    'Workshop title: ' +
    expected.title +
    '\nDuration: ' +
    expected.durationMinutes +
    ' minutes\nPrerequisites, in order: ' +
    expected.prerequisites.join(', ') +
    '\nPublished: ' +
    (expected.published ? 'yes' : 'no');
  return { name: value, sourceText, expected };
}

export function selectSchema(value: unknown) {
  if (value !== 'valid' && value !== 'invalid-schema')
    throw new Error('INVALID_MODE · Select a valid schema or the deliberate malformed schema.');
  return value === 'invalid-schema' ? { ...workshopSchema, required: 'title' } : workshopSchema;
}
