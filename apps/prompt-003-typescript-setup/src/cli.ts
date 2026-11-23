import 'dotenv/config';
import { runAgent } from './agent.js';

try {
  const result = await runAgent(process.argv.slice(2).join(' ') || 'Reply with READY.');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The run failed.');
  process.exitCode = 1;
}
