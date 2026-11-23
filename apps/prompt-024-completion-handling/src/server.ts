import express from 'express';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import 'dotenv/config';
import {root,runCompletion} from './agent.js';
import {exceptionOutcome} from './outcome.js';

const app = express();
const reports = new Map<string,string>();
let busy = false;
app.disable('x-powered-by');
app.use((request,response,next) => {
  response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  if (request.method === 'POST' && request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    response.status(403).json({outcome:exceptionOutcome(new Error('Unexpected request origin.'))});return;
  }
  next();
});
app.use(express.json({limit:'4kb'}));
app.use(express.static(path.join(root,'public')));
app.post('/api/run',async (request,response) => {
  if (busy) {response.status(409).json({outcome:exceptionOutcome(new Error('Wait for the current completion experiment to finish.'))});return;}
  busy = true;
  try {
    const report = {id:randomUUID(),...await runCompletion(request.body?.mode)};
    const directory = path.join(root,'runs',report.id);await mkdir(directory,{recursive:true});
    const file = path.join(directory,'report.json');await writeFile(file,JSON.stringify(report,null,2));
    reports.set(report.id,file);response.json(report);
  } catch (error) {response.status(422).json({outcome:exceptionOutcome(error)});}
  finally {busy = false;}
});
const sources = ['src/outcome.ts','src/agent.ts','src/cli.ts','src/server.ts'];
app.get('/api/source',async (request,response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {response.status(404).end();return;}
  response.json({file,files:sources,content:await readFile(path.join(root,file),'utf8')});
});
app.get('/api/report/:id',(request,response) => {
  const file = reports.get(String(request.params.id));
  if (!file) {response.status(404).end();return;}
  response.download(file,'completion-observed-report.json');
});
app.use((error:unknown,_request:express.Request,response:express.Response,_next:express.NextFunction) => {
  response.status(400).json({outcome:exceptionOutcome(error)});
});
const port = Number(process.env.PORT || 43124);
app.listen(port,'127.0.0.1',() => console.log(`Prompt 24 lab http://127.0.0.1:${port}`));
