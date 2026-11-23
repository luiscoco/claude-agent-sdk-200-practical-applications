import 'dotenv/config';
import { runSearch } from './agent.js';
const report = await runSearch(process.argv[2] || 'matches');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
