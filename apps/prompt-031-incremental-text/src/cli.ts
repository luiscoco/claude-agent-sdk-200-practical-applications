import 'dotenv/config';
import { defaultPrompt, runTextStream } from './stream.js';

try {
  const report = await runTextStream(process.argv[2] || 'incremental', defaultPrompt, (event) => {
    if (event.type === 'render-text') process.stdout.write(event.text || '');
  });
  process.stdout.write('\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified || !report.success) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
