import 'dotenv/config';
import {runConventions} from './agent.js';

try {
  const target = process.argv.includes('--docs') ? 'documentation' : 'typescript';
  console.log(JSON.stringify(await runConventions(target, !process.argv.includes('--no-settings')), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Project convention experiment failed.');
  process.exitCode = 1;
}
