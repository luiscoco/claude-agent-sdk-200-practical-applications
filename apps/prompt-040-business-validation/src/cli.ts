import 'dotenv/config';
import { runBusiness } from './agent.js';
const report = await runBusiness(process.argv[2] || 'correct');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
