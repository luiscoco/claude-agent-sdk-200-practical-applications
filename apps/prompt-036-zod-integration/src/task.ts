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
