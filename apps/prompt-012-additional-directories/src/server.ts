import express from 'express';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import 'dotenv/config';
import {root,directoryConfiguration} from './directories.js';
import {runDirectoryExperiment} from './agent.js';

const app=express();
let busy=false;
const reports=new Map<string,string>();
app.disable('x-powered-by');
app.use((request,response,next)=>{
  response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  if(request.method==='POST'&&request.headers.origin&&request.headers.origin!==`http://${request.headers.host}`){response.status(403).json({error:'Unexpected request origin.'});return;}
  next();
});
app.use(express.json({limit:'4kb'}));
app.use(express.static(path.join(root,'public')));
app.post('/api/inspect',async(request,response)=>{
  try{response.json(await directoryConfiguration(request.body?.grantShared,request.body?.loadProjectSettings));}
  catch(error){response.status(422).json({error:error instanceof Error?error.message:'Inspection failed.'});}
});
app.post('/api/run',async(request,response)=>{
  if(busy){response.status(409).json({error:'Wait for the current run to finish.'});return;}
  busy=true;
  try{
    const result=await runDirectoryExperiment(request.body?.grantShared,request.body?.loadProjectSettings);
    const id=randomUUID();const directory=path.join(root,'runs',id);
    await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'report.json'),JSON.stringify({id,...result},null,2));
    reports.set(id,directory);response.json({id,...result});
  }catch(error){
    const message=error instanceof Error?error.message:'Run failed.';
    response.status(422).json({error:process.env.ANTHROPIC_API_KEY?message.replaceAll(process.env.ANTHROPIC_API_KEY,'[REDACTED]'):message});
  }finally{busy=false;}
});
const sources=['src/agent.ts','src/directories.ts','src/server.ts','src/cli.ts','fixtures/shared/.claude/commands/shared-pricing-note.md','fixtures/shared/prices.txt'];
app.get('/api/source',async(request,response)=>{
  const file=String(request.query.file||sources[0]);if(!sources.includes(file)){response.status(404).end();return;}
  response.json({file,files:sources,content:await readFile(path.join(root,file),'utf8')});
});
app.get('/api/report/:id',(request,response)=>{
  const directory=reports.get(String(request.params.id));if(!directory){response.status(404).end();return;}
  response.download(path.join(directory,'report.json'),'additional-directories-result.json');
});
const port=Number(process.env.PORT||43112);
app.listen(port,'127.0.0.1',()=>console.log(`Prompt 12 lab http://127.0.0.1:${port}`));
