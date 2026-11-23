import 'dotenv/config';
import { editSource } from './agent.js';
const report = await editSource(process.argv[2] || 'edit', Number(process.argv[3] ?? 550));
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
