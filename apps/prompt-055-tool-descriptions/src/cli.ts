import 'dotenv/config';
import { runDescriptionSuite } from './agent.js';
const [descriptionMode = 'specific', suite = 'core'] = process.argv.slice(2);
try {
  const report = await runDescriptionSuite({ descriptionMode, suite });
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Description experiment failed.');
  process.exitCode = 1;
}
