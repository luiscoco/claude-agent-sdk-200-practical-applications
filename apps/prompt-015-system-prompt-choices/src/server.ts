import express from 'express';
import path from 'node:path';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import 'dotenv/config';
import {runProfile} from './agent.js';
import {task} from './profiles.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
const reports = new Map<string, string>();
let busy = false;

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  if (request.method === 'POST' && request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    response.status(403).json({error: 'Unexpected request origin.'});
    return;
  }
  next();
});
app.use(express.json({limit: '4kb'}));
app.use(express.static(path.join(root, 'public')));

app.get('/api/task', (_request, response) => response.json({task}));
app.post('/api/run', async (request, response) => {
  if (busy) {
    response.status(409).json({error: 'Wait for the current experiment to finish.'});
    return;
  }
  busy = true;
  const completed = [];
  try {
    const selection = String(request.body?.mode || 'minimal');
    const modes = selection === 'compare' ? ['minimal', 'preset', 'custom'] : [selection];
    for (const mode of modes) completed.push(await runProfile(mode));
    const id = randomUUID();
    const directory = path.join(root, 'runs', id);
    await mkdir(directory, {recursive: true});
    const report = {id, task, results: completed};
    await writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
    reports.set(id, directory);
    response.json(report);
  } catch (error) {
    response.status(422).json({
      error: error instanceof Error ? error.message : 'Experiment failed.',
      completedResults: completed
    });
  } finally {
    busy = false;
  }
});

const sources = ['src/profiles.ts', 'src/agent.ts', 'src/server.ts', 'src/cli.ts'];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {
    response.status(404).end();
    return;
  }
  response.json({file, files: sources, content: await readFile(path.join(root, file), 'utf8')});
});
app.get('/api/report/:id', (request, response) => {
  const directory = reports.get(String(request.params.id));
  if (!directory) {
    response.status(404).end();
    return;
  }
  response.download(path.join(directory, 'report.json'), 'system-prompt-comparison.json');
});

const port = Number(process.env.PORT || 43115);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 15 lab http://127.0.0.1:${port}`));
