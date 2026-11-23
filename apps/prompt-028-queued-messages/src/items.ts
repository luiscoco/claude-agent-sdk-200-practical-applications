import { randomUUID } from 'node:crypto';

export function prepareItems(duplicate = false) {
  const items = ['A', 'B', 'C'].map((key, index) => ({
    id: randomUUID(),
    key,
    expected: (index + 1) * 2,
    prompt:
      'Queue item ' +
      key +
      '. Compute ' +
      (index + 1) +
      ' + ' +
      (index + 1) +
      '. Report this item as ' +
      key +
      '=<integer answer>.',
  }));
  if (duplicate) items[1].id = items[0].id;
  return items;
}
export type QueueItem = ReturnType<typeof prepareItems>[number];
export type QueueResult = {
  sequence: number;
  coveredIds: string[];
  answer: string;
  subtype: string;
  isError: boolean;
  sessionId: string;
};

export function validateItems(items: QueueItem[]) {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error('DUPLICATE_MESSAGE_ID · Assign a distinct UUID to each new queue item.');
}
export function verifyOrder(items: QueueItem[], yieldedIds: string[], results: QueueResult[]) {
  const expectedIds = items.map((item) => item.id);
  const coveredIds = [...new Set(results.flatMap((result) => result.coveredIds))];
  const sameOrder = (ids: string[]) =>
    ids.length === expectedIds.length && ids.every((id, index) => id === expectedIds[index]);
  return (
    sameOrder(yieldedIds) &&
    sameOrder(coveredIds) &&
    results.every(
      (result) => result.coveredIds.length > 0 && !result.isError && result.subtype === 'success',
    )
  );
}
export function verifyAnswers(items: QueueItem[], results: QueueResult[]) {
  return results.every((result) => {
    const answers = new Map(
      [...result.answer.matchAll(/\b([ABC])\s*=\s*([+-]?\d+)/g)].map((match) => [
        match[1],
        Number(match[2]),
      ]),
    );
    return items
      .filter((item) => result.coveredIds.includes(item.id))
      .every((item) => answers.get(item.key) === item.expected);
  });
}
