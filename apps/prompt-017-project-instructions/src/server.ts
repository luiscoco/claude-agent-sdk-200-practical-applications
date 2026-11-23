import express from 'express';
import path from 'node:path';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import 'dotenv/config';
import {runConventions} from './agent.js';
import {root} from './project.js';

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
app.post('/api/run', async (request, response) => {
  if (busy) {
    response.status(409).json({error: 'Wait for the current convention check to finish.'});
    return;
  }
  busy = true;
  try {
    const result = await runConventions(String(request.body?.target || 'typescript'), request.body?.loadProjectSettings);
    const id = randomUUID();
    const directory = path.join(root, 'runs', id);
    await mkdir(directory, {recursive: true});
    await writeFile(path.join(directory, 'report.json'), JSON.stringify({id, ...result}, null, 2));
    reports.set(id, directory);
    response.json({id, ...result});
  } catch (error) {
    response.status(422).json({error: error instanceof Error ? error.message : 'Convention check failed.'});
  } finally {
    busy = false;
  }
});

const sources = ['src/project.ts', 'src/agent.ts', 'fixtures/project/CLAUDE.md', 'fixtures/project/.claude/rules/typescript.md', 'fixtures/project/src/component-request.ts', 'fixtures/project/docs/guide.md', 'src/server.ts', 'src/cli.ts'];
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
  response.download(path.join(directory, 'report.json'), 'project-conventions-result.json');
});

const port = Number(process.env.PORT || 43117);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 17 lab http://127.0.0.1:${port}`));
