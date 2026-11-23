import 'dotenv/config';
import { runComparison } from './agent.js';
const report = await runComparison(process.argv[2] || 'embedded', process.argv[3] || 'correct');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
