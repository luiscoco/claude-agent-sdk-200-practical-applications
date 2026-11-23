import 'dotenv/config';
import { runDevelopmentCommand } from './agent.js';
const report = await runDevelopmentCommand(process.argv[2] || 'success');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
