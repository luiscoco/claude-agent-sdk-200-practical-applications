import 'dotenv/config';
import { BackgroundSession } from './background.js';
const mode = process.argv[2] || 'complete';
const session = await BackgroundSession.create(mode);
try {
  if (mode === 'cancel') {
    while ((await session.snapshot()).stage === 'starting')
      await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await session.cancel();
  }
  await session.done;
  const report = await session.snapshot();
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} finally {
  session.close();
}
