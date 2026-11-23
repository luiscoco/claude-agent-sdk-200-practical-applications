import 'dotenv/config';
import { readSource } from './agent.js';
const report = await readSource(process.argv[2] || 'existing', process.argv[3] || 'total');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
