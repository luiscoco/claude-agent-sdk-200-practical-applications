import 'dotenv/config';
import { editNotebook } from './agent.js';
const report = await editNotebook(process.argv[2] || 'edit');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
