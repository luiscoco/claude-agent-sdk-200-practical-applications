import 'dotenv/config';
import { retrievePage } from './agent.js';
const report = await retrievePage(process.argv[2] || 'fetch');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
