import 'dotenv/config';
import {runProfile} from './agent.js';

try {
  console.log(JSON.stringify(await runProfile(process.argv[2] || 'minimal'), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Profile experiment failed.');
  process.exitCode = 1;
}
