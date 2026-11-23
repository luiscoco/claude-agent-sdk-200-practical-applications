import 'dotenv/config';
import {runStyleExperiment} from './agent.js';

try {
  console.log(JSON.stringify(await runStyleExperiment(process.argv.includes('--default') ? 'default' : 'teaching-report'), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Output-style experiment failed.');
  process.exitCode = 1;
}
