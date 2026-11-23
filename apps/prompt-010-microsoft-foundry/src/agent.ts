import {query} from '@anthropic-ai/claude-agent-sdk';
import {foundryConfiguration} from './config.js';

export async function runFoundry(resource:string,deployment:string){
  const configuration=foundryConfiguration(resource,deployment);
  const events:{type:string;detail:string;data?:unknown}[]=[];
  const run=query({prompt:'Reply with READY.',options:{
    env:configuration.environment,
    model:deployment,
    tools:[],mcpServers:{},settingSources:[],maxTurns:2,maxBudgetUsd:.10
  }});
  try{
    for await(const message of run){
      if(message.type==='system'&&message.subtype==='init')events.push({type:'initialized',detail:'SDK session initialized with the selected Foundry deployment.',data:{model:message.model,apiKeySource:message.apiKeySource,sessionId:message.session_id}});
      if(message.type!=='result')continue;
      if(message.subtype!=='success'||message.is_error){
        const detail=message.subtype==='success'?message.result:message.errors.join(' ');
        throw new Error('SDK_RESULT_ERROR · '+detail.slice(0,3000));
      }
      events.push({type:'result',detail:'Successful Foundry-backed SDK result received.'});
      return {configuration:configuration.summary,answer:message.result,sessionId:message.session_id,estimatedCostUsd:message.total_cost_usd,events};
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  }finally{run.close();}
}
