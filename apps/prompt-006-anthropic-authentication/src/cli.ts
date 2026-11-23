import { inspectAuthentication } from './auth.js';
import { runAuthenticatedAgent } from './agent.js';

const mode = process.argv.includes('--blank') ? 'blank' : process.argv.includes('--environment') ? 'environment' : 'dotenv';
try {
  const result = process.argv.includes('--check')
    ? inspectAuthentication(mode)
    : await runAuthenticatedAgent('Reply with READY.',mode);
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Authentication failed.');
  process.exitCode = 1;
}
