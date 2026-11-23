import 'dotenv/config';
import {runMessageExperiment} from './agent.js';
try {
  const report = await runMessageExperiment(process.argv.includes('--denied') ? 'denied' : 'success');
  console.log(JSON.stringify(report,null,2));
  if (!report.verified) process.exitCode = 1;
}
catch (error) {console.error(error instanceof Error ? error.message : 'Message experiment failed.');process.exitCode = 1;}
