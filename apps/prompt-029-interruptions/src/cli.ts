import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { InterruptionSession } from './interruption.js';

const session = new InterruptionSession();
try {
  while (session.snapshot().stage === 'starting') await delay(100);
  await delay(1000);
  await session.interrupt();
  while (session.snapshot().stage === 'interrupting') await delay(100);
  session.continue('Reply with exactly CONTINUED');
  await session.done;
  const report = session.snapshot();
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  session.close();
  await session.done;
}
