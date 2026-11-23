import {spawn} from 'node:child_process';
import {startup,type WarmQuery} from '@anthropic-ai/claude-agent-sdk';

process.env.CLAUDE_COURSE_PARENT='PARENT_MARKER';
process.env.CLAUDE_COURSE_CUSTOM='parent-default';

export async function inspectTypeScriptEnvironment(preserveParent:boolean){
  const env=preserveParent
    ? {...process.env,CLAUDE_COURSE_CUSTOM:'child-override'}
    : {CLAUDE_COURSE_CUSTOM:'child-override'};
  let observed:{parentMarker:string|null;customValue:string|null;pathPresent:boolean;apiKeyPresent:boolean}|undefined;
  let warm:WarmQuery|undefined;
  let initializationError:string|null=null;
  try{
    warm=await startup({initializeTimeoutMs:15000,options:{
      env,tools:[],settingSources:[],mcpServers:{},persistSession:false,
      spawnClaudeCodeProcess:options=>{
        const environment=options.env;
        observed={
          parentMarker:environment.CLAUDE_COURSE_PARENT??null,
          customValue:environment.CLAUDE_COURSE_CUSTOM??null,
          pathPresent:Object.keys(environment).some(name=>name.toLowerCase()==='path'&&Boolean(environment[name])),
          apiKeyPresent:Boolean(environment.ANTHROPIC_API_KEY)
        };
        return spawn(options.command,options.args,{cwd:options.cwd,env:environment,signal:options.signal,windowsHide:true,stdio:['pipe','pipe','pipe']});
      }
    }});
  }catch(error){initializationError=error instanceof Error?error.message:'Runtime initialization failed.';}
  finally{warm?.close();}
  if(!observed)throw new Error('SPAWN_NOT_OBSERVED · The SDK spawn callback did not run.');
  return {sdk:'TypeScript',mode:preserveParent?'preserve-parent':'replacement',initialized:initializationError===null,initializationError,observed,verified:observed.parentMarker===(preserveParent?'PARENT_MARKER':null)&&observed.customValue==='child-override',modelPromptSent:false,evidence:'Observed SDK spawnClaudeCodeProcess environment passed to the real native process.'};
}
