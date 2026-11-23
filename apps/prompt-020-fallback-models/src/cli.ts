import 'dotenv/config';
import {runFallback} from './agent.js';
try {
  const result = await runFallback(process.argv[2] || 'fallback');
  console.log(JSON.stringify(result,null,2));
  if (!result.success) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Fallback experiment failed.');
  process.exitCode = 1;
}
