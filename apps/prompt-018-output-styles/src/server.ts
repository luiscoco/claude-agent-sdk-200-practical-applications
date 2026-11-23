import express from 'express';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import 'dotenv/config';
import {runStyleExperiment} from './agent.js';
import {root} from './workspace.js';

const app = express();
const reports = new Map<string, string>();
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
app.use(express.json({limit:'4kb'}));
app.use(express.static(path.join(root, 'public')));

app.post('/api/run', async (request, response) => {
  if (busy) {
    response.status(409).json({error:'Wait for the current output-style experiment to finish.'});
    return;
  }
  busy = true;
  try {
    const report = await runStyleExperiment(request.body?.style);
    reports.set(report.id, path.join(root, 'runs', report.id, 'report.json'));
    response.json(report);
  } catch (error) {
    response.status(422).json({error:error instanceof Error ? error.message : 'Output-style experiment failed.'});
  } finally { busy = false; }
});

const sources = ['fixtures/template/.claude/output-styles/teaching-report.md', 'fixtures/template/src/calculator.mjs', 'fixtures/template/tests/calculator.test.mjs', 'src/agent.ts', 'src/workspace.ts', 'src/server.ts', 'src/cli.ts'];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) { response.status(404).end(); return; }
  response.json({file, files:sources, content:await readFile(path.join(root, file), 'utf8')});
});
app.get('/api/report/:id', (request, response) => {
  const file = reports.get(String(request.params.id));
  if (!file) { response.status(404).end(); return; }
  response.download(file, 'output-style-observed-report.json');
});
const port = Number(process.env.PORT || 43118);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 18 lab http://127.0.0.1:${port}`));
