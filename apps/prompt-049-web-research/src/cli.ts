import 'dotenv/config';
import { researchWeb } from './agent.js';
import { defaultQuestion } from './research.js';
const report = await researchWeb(process.argv[2] || 'search', process.argv[3] || defaultQuestion);
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
