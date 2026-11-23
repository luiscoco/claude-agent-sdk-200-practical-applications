import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { diagnoseRuntime } from './diagnostics.mjs';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
const reports = new Map();
let busy = false;
app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  if (request.method === 'POST' && request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    response.status(403).json({error:'Unexpected request origin.'});
    return;
  }
  next();
});
app.use(express.json({limit:'2kb'}));
app.use(express.static(path.join(root, 'public')));
app.post('/api/inspect', async (request, response) => {
  if (busy) { response.status(409).json({error:'An inspection is already running.'}); return; }
  busy = true;
  try {
    const report = await diagnoseRuntime(request.body);
    const id = randomUUID();
    const directory = path.join(root, 'runs', id);
    await mkdir(directory, {recursive:true});
    await writeFile(path.join(directory, 'report.json'), JSON.stringify({id,...report}, null, 2));
    reports.set(id, directory);
    response.json({id,...report});
  } catch (error) {
    response.status(422).json({error:error.message});
  } finally { busy = false; }
});
app.get('/api/report/:id', (request, response) => {
  const directory = reports.get(request.params.id);
  if (!directory) { response.status(404).end(); return; }
  response.download(path.join(directory, 'report.json'), 'runtime-diagnostics.json');
});
const sources = ['src/diagnostics.mjs','src/server.mjs','src/cli.mjs'];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) { response.status(404).end(); return; }
  response.json({file,files:sources,content:await readFile(path.join(root,file),'utf8')});
});
app.listen(Number(process.env.PORT || 43105), '127.0.0.1', () => console.log('Prompt 5 lab http://127.0.0.1:43105'));
