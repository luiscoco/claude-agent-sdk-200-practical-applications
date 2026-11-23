import {query, type SDKControlReadFileResponse} from '@anthropic-ai/claude-agent-sdk';
import {directoryConfiguration,fixtureContent} from './directories.js';

export async function runDirectoryExperiment(grantShared:boolean,loadProjectSettings:boolean){
  const configuration=await directoryConfiguration(grantShared,loadProjectSettings);
  if(!process.env.ANTHROPIC_API_KEY?.trim())throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const probes:{file:string;exists:boolean;readable:boolean;response:SDKControlReadFileResponse|null;matchesFixture:boolean}[]=[];
  let initializedCwd='';
  let discoveredCommands:string[]=[];
  const run=query({prompt:'Reply with READY.',options:{
    cwd:configuration.cwd,
    additionalDirectories:configuration.additionalDirectories,
    settingSources:configuration.settingSources,
    tools:[],mcpServers:{},
    model:process.env.CLAUDE_MODEL||'claude-sonnet-4-6',maxTurns:2,maxBudgetUsd:.10
  }});
  try{
    for await(const message of run){
      if(message.type==='system'&&message.subtype==='init'){
        initializedCwd=message.cwd;
        discoveredCommands=message.slash_commands.filter(name=>name==='shared-pricing-note');
        for(const fixture of configuration.fixtures){
          const response=await run.readFile(fixture.absolute,{maxBytes:8192});
          const matchesFixture=response!==null&&response.contents===await fixtureContent(fixture.file);
          probes.push({file:fixture.file,exists:fixture.exists,readable:response!==null,response,matchesFixture});
        }
      }
      if(message.type!=='result')continue;
      if(message.subtype!=='success'||message.is_error)throw new Error('SDK_RESULT_ERROR · '+message.subtype);
      const expectedReadable=[true,grantShared,false];
      const fileChecksPassed=probes.length===3&&probes.every((probe,index)=>probe.readable===expectedReadable[index]&&(!probe.readable||probe.matchesFixture));
      const commandExpected=grantShared&&loadProjectSettings;
      const commandCheckPassed=discoveredCommands.includes('shared-pricing-note')===commandExpected;
      return {configuration,initializedCwd,probes,discoveredCommands,commandExpected,fileChecksPassed,commandCheckPassed,verified:fileChecksPassed&&commandCheckPassed,answer:message.result,sessionId:message.session_id,estimatedCostUsd:message.total_cost_usd};
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  }finally{run.close();}
}
