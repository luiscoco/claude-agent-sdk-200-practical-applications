import 'dotenv/config';
import {foundryConfiguration} from './config.js';
import {runFoundry} from './agent.js';

try{
  const resource=process.env.ANTHROPIC_FOUNDRY_RESOURCE||'';
  const deployment=process.env.CLAUDE_MODEL||'claude-sonnet-5-5';
  const result=process.argv.includes('--inspect')?foundryConfiguration(resource,deployment).summary:await runFoundry(resource,deployment);
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error instanceof Error?error.message:'Command failed.');process.exitCode=1;}
