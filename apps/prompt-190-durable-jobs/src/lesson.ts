import path from 'node:path';
import { JobQueue } from './application.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const file = path.join(process.env.LAB_WORKSPACE!, 'jobs.json'), queue = new JobQueue(file), first = await queue.enqueue('delivery-1', 'Explain one idempotency safeguard.', 1000), duplicate = await queue.enqueue('delivery-1', 'ignored', 1000);
  const later = await queue.enqueue('later', 'not due', 999999), cancelled = await queue.enqueue('cancel', 'must not run', 1000); await queue.cancel(cancelled.id);
  const failed = await queue.execute(async () => { throw new Error('Owned transient failure'); }, 1000), premature = await queue.execute(async () => 'too early', 1500);
  const restarted = new JobQueue(file); let observed: any;
  const completed = await restarted.execute(async payload => { observed = await native(payload, {}, mode === 'live'); requireNative(observed, mode !== 'live'); return mode === 'live' ? observed.events.findLast((e: any) => e.type === 'result')?.result : 'transcript-only completed'; }, 2000);
  const jobs = await restarted.all();
  return report(jobs, { idempotentEnqueue: first.id === duplicate.id, retryPersisted: failed?.state === 'retry', backoffRespected: premature === null, replacementWorkerCompletes: completed?.state === 'succeeded' && completed.attempts === 2, cancellationRespected: jobs.find(job => job.id === cancelled.id)?.state === 'cancelled', schedulingRespected: jobs.find(job => job.id === later.id)?.attempts === 0 }, observed, 'Durable single-writer JSON queue with controlled clock. Distributed workers need transactional leasing. Crash recovery for running leases is intentionally outside this adapter; never deploy it as a multi-writer queue.');
}
