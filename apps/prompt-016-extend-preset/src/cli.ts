import 'dotenv/config';
import {runInventoryAgent} from './agent.js';

try {
  console.log(JSON.stringify(await runInventoryAgent(!process.argv.includes('--base')), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Inventory experiment failed.');
  process.exitCode = 1;
}
