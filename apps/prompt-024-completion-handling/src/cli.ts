import 'dotenv/config';
import {runCompletion} from './agent.js';
const report = await runCompletion(process.argv[2] || 'success');
console.log(JSON.stringify(report,null,2));
if (!report.outcome.ok) process.exitCode = 1;
