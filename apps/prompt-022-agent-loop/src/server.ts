import express from 'express';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { RunService } from './service.js';
config({quiet:true});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const service=new RunService(path.join(root,'runs'));
const app=express();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  if(req.method==='POST' && req.headers.origin && req.headers.origin!==`${req.protocol}://${req.headers.host}`){res.status(403).json({error:'Unexpected request origin.'});return;}
  next();
});
app.use(express.json({limit:'20kb'}));
app.use(express.static(path.join(root,'public')));
app.get('/api/config',async(_req,res)=>{
  config({quiet:true});
  const sdk=JSON.parse(await readFile(path.join(root,'node_modules/@anthropic-ai/claude-agent-sdk/package.json'),'utf8'));
  res.json({apiConfigured:!!process.env.ANTHROPIC_API_KEY?.trim(),model:process.env.CLAUDE_MODEL||'claude-sonnet-4-6',sdkVersion:sdk.version,lesson:22});
});
app.get('/api/fixtures/:name',async(req,res)=>{
  if(!['valid','invalid'].includes(String(req.params.name))){res.status(404).json({error:'Unknown fixture.'});return;}
  res.type('text/plain').send(await readFile(path.join(root,'fixtures',String(req.params.name)+'.txt'),'utf8'));
});
const sources=['src/agent.ts','src/numbers.ts','src/service.ts','src/server.ts','src/cli.ts'];
app.get('/api/source',async(req,res)=>{
  const file=String(req.query.file||'src/agent.ts');
  if(!sources.includes(file)){res.status(404).json({error:'Unknown source file.'});return;}
  res.json({file,content:await readFile(path.join(root,file),'utf8'),files:sources});
});
app.post('/api/runs',(req,res)=>{
  if(!req.is('application/json')||!req.body||typeof req.body.text!=='string'||!['agent','verify'].includes(req.body.mode)){res.status(400).json({error:'Provide a JSON body with text and mode agent or verify.'});return;}
  if([...service.runs.values()].some(r=>r.status==='running')){res.status(409).json({error:'Finish or cancel the current run first.'});return;}
  const run=service.start(req.body.mode,req.body.text);
  res.status(202).json({id:run.id});
});
app.get('/api/runs/:id',(req,res)=>{
  const run=service.runs.get(String(req.params.id));
  if(!run){res.status(404).json({error:'Unknown run.'});return;}
  res.json({id:run.id,status:run.status,mode:run.mode,events:run.events,report:run.report,error:run.error});
});
app.get('/api/runs/:id/events',(req,res)=>{
  const run=service.runs.get(String(req.params.id));
  if(!run){res.status(404).end();return;}
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.flushHeaders();
  const send=(event:unknown)=>{if(!res.destroyed)res.write(`data: ${JSON.stringify(event)}\n\n`);};
  for(const event of run.events)send(event);
  run.listeners.add(send);
  req.on('close',()=>run.listeners.delete(send));
});
app.post('/api/runs/:id/cancel',(req,res)=>{
  const run=service.runs.get(String(req.params.id));
  if(!run){res.status(404).json({error:'Unknown run.'});return;}
  run.controller.abort();res.json({requested:true});
});
app.get('/api/runs/:id/files/:name',async(req,res)=>{
  const run=service.runs.get(String(req.params.id)),name=String(req.params.name);
  if(!run||!['report.json','report.md','events.jsonl','values.txt','failure.json'].includes(name)){res.status(404).end();return;}
  if(name.startsWith('report')&&run.status!=='completed'){res.status(409).json({error:'No verified report is available.'});return;}
  res.download(path.join(root,'runs',run.id,name),name,error=>{if(error&&!res.headersSent)res.status(404).end();});
});
app.use((error:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(500).json({error:error.message==='request entity too large'?'Input is too large.':'The request could not be completed.'}));
const port=Number(process.env.PORT||43122);
const server=app.listen(port,'127.0.0.1',()=>console.log(`Prompt 22 lab: http://127.0.0.1:${port}`));
process.on('SIGINT',()=>{for(const run of service.runs.values())run.controller.abort();server.close(()=>process.exit(0));});
