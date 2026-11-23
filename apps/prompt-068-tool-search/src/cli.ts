import 'dotenv/config';
import { runSearch } from './agent.js';
try {
  const report = await runSearch({
    mode: process.argv[2] || 'low-threshold',
    lessonId: Number(process.argv[3] || 17),
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  let message = error instanceof Error ? error.message : 'Tool-search experiment failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.error(message);
  process.exitCode = 1;
}
