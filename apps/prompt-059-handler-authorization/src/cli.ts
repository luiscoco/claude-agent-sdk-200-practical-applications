import 'dotenv/config';
import { runAuthorization } from './agent.js';
const [actor = 'alice', projectId = 'alice-lab'] = process.argv.slice(2);
try {
  const report = await runAuthorization({ actor, projectId });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Authorization experiment failed.');
  process.exitCode = 1;
}
