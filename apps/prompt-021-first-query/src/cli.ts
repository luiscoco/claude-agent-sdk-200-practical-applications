import 'dotenv/config';
import {firstQuery} from './agent.js';
import {examples} from './prompt.js';
try {
  console.log(JSON.stringify(await firstQuery(process.argv.slice(2).join(' ') || examples.arithmetic.prompt),null,2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'First query failed.');
  process.exitCode = 1;
}
