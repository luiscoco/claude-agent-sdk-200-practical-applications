import 'dotenv/config';
import { launch } from './launch.js';
import { writeFile } from 'node:fs/promises';
try {
  const report = await launch(process.argv[2] || 'local');
  await writeFile('last-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.verified) process.exitCode = 1;
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
