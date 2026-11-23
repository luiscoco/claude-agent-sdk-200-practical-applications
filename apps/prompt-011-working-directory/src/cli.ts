import 'dotenv/config';
import { inspectProject } from './projects.js';
import { runProject } from './agent.js';

try {
  const name=process.argv.find(value=>['orbit','harbor','missing'].includes(value))||'orbit';
  const result=process.argv.includes('--inspect')?await inspectProject(name):await runProject(name,!process.argv.includes('--no-settings'));
  console.log(JSON.stringify(result,null,2));
} catch(error) {
  console.error(error instanceof Error?error.message:'The command failed.');
  process.exitCode=1;
}
