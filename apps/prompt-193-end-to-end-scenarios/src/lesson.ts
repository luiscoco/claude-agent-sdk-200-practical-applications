import path from 'node:path';
import { MemoryStore, retrieve, JobQueue } from './application.js';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const root = process.env.LAB_WORKSPACE!, memory = new MemoryStore(path.join(root, 'memory')), queue = new JobQueue(path.join(root, 'jobs.json'));
  await memory.put('alice', 'language', 'English'); const job = await queue.enqueue('delivery-193', 'delivery retry', 1000);
  const evidence = await exercise(mode, 'Determine the retry policy, using this customer’s saved preference. Cite the evidence ID.', async input => ({ memory: await memory.list('alice'), documents: retrieve(input) }), 'delivery retry');
  const completed = await queue.execute(async () => JSON.stringify(evidence.local), 1000), result = JSON.parse(completed!.result!);
  const answer = evidence.observed.events.findLast(e => e.type === 'result')?.result || '';
  return report({ jobId: job.id, persistedOutcome: result, liveAnswer: mode === 'live' ? answer : null }, { jobActuallyCompleted: completed?.state === 'succeeded', relevantEvidenceAvailable: result.documents.some((doc: any) => doc.id === 'D1'), preferenceRetrievable: result.memory[0].text === 'English', resultDurable: (await new JobQueue(queue.file).all())[0].result === completed?.result, liveOutcomeGrounded: mode !== 'live' || /D1/.test(answer) && /three|3/.test(answer) }, evidence, 'Realistic memory→retrieval→durable-job pipeline. Checks observable persisted outcomes and evidence references rather than exact generated wording.');
}
