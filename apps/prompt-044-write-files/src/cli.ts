import 'dotenv/config';
import { writeReport } from './agent.js';
const report = await writeReport(process.argv[2] || 'create');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
