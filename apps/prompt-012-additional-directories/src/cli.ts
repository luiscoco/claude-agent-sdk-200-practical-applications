import 'dotenv/config';
import {directoryConfiguration} from './directories.js';
import {runDirectoryExperiment} from './agent.js';

try{
  const grantShared=process.argv.includes('--grant');
  const loadProjectSettings=!process.argv.includes('--no-settings');
  const result=process.argv.includes('--inspect')?await directoryConfiguration(grantShared,loadProjectSettings):await runDirectoryExperiment(grantShared,loadProjectSettings);
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error instanceof Error?error.message:'Command failed.');process.exitCode=1;}
