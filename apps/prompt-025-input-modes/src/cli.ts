import 'dotenv/config';
import {runInputMode} from './agent.js';
try {
  const report = await runInputMode(process.argv[2] || 'string',12,30);
  console.log(JSON.stringify(report,null,2));
  if (!report.success) process.exitCode = 1;
} catch (error) {console.error(error instanceof Error ? error.message : 'Input-mode experiment failed.');process.exitCode = 1;}
