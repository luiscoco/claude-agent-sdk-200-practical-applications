import 'dotenv/config';
import { runFailures } from './agent.js';
const report = await runFailures(process.argv[2] || 'exhausted');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
