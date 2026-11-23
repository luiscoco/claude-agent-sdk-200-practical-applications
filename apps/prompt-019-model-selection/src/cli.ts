import 'dotenv/config';
import {runModel} from './agent.js';
import {defaultModel, listModels} from './models.js';
try {
  const result = process.argv.includes('--list') ? await listModels() : await runModel(process.argv[2] || defaultModel);
  console.log(JSON.stringify(result,null,2));
  if ('success' in result && !result.success) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Model experiment failed.');
  process.exitCode = 1;
}
