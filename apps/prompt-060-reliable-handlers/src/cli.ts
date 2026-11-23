import 'dotenv/config';
import { runReliableHandler } from './agent.js';
import { createOperationControl, requestCancellation } from './handler.js';
const mode = process.argv[2] || 'retry-after-timeout';
const control = createOperationControl();
const cancellation = mode === 'cancel' ? setInterval(() => requestCancellation(control), 50) : null;
try {
  const report = await runReliableHandler({ mode, label: 'Classroom booking' }, control);
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Reliability experiment failed.');
  process.exitCode = 1;
} finally {
  if (cancellation) clearInterval(cancellation);
}
