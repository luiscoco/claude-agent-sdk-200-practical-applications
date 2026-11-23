import 'dotenv/config';
import { runAnnotations } from './agent.js';
const [mode = 'write-repeat', confirmation = 'false', value = 'Updated classroom note'] =
  process.argv.slice(2);
try {
  const report = await runAnnotations({ mode, confirmDelete: confirmation === 'true', value });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Annotation experiment failed.');
  process.exitCode = 1;
}
