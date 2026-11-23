import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runAgent } from './agent.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
let busy = false;
const reports = new Map<string,string>();
app.disable('x-powered-by');
app.use((request,response,next)=>{
  response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  if(request.method==='POST'&&request.headers.origin&&request.headers.origin!==`http://${request.headers.host}`){response.status(403).end();return;}
  next();
});
app.use(express.json({limit:'4kb'}));
app.use(express.static(path.join(root,'public')));
app.get('/api/config',(_request,response)=>response.json({apiConfigured:!!process.env.ANTHROPIC_API_KEY?.trim(),model:process.env.CLAUDE_MODEL||'claude-sonnet-4-6'}));
app.post('/api/run',async(request,response)=>{
  if(typeof request.body?.prompt!=='string'||request.body.prompt.length>1000){response.status(400).json({error:'Supply a prompt of at most 1000 characters.'});return;}
  if(busy){response.status(409).json({error:'Wait for the current run to finish.'});return;}
  busy=true;
  try{
    const result=await runAgent(request.body.prompt);
    const id=randomUUID();const directory=path.join(root,'runs',id);await mkdir(directory,{recursive:true});
    await writeFile(path.join(directory,'report.json'),JSON.stringify({id,prompt:request.body.prompt,...result},null,2));
    reports.set(id,directory);response.json({id,...result});
  }catch(error){
    const message=error instanceof Error?error.message:'Run failed.';
    response.status(422).json({error:process.env.ANTHROPIC_API_KEY?message.replaceAll(process.env.ANTHROPIC_API_KEY,'[REDACTED]'):message});
  }finally{busy=false;}
});
const sources=['src/agent.ts','src/cli.ts','src/server.ts','package.json'];
app.get('/api/source',async(request,response)=>{
  const file=String(request.query.file||sources[0]);if(!sources.includes(file)){response.status(404).end();return;}
  response.json({file,files:sources,content:await readFile(path.join(root,file),'utf8')});
});
app.get('/api/report/:id',(request,response)=>{
  const directory=reports.get(String(request.params.id));if(!directory){response.status(404).end();return;}
  response.download(path.join(directory,'report.json'),'agent-result.json');
});
app.listen(Number(process.env.PORT||43103),'127.0.0.1',()=>console.log('Prompt 3 lab http://127.0.0.1:43103'));
