import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { expectedContent, runToolStream, validateMode } from './agent.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
const reports = new Map<string, string>();
let busy = false;
app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  );
  if (
    request.method === 'POST' &&
    request.headers.origin &&
    request.headers.origin !== `http://${request.headers.host}`
  ) {
    response.status(403).json({ error: 'Unexpected request origin.' });
    return;
  }
  next();
});
app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(root, 'public')));
app.get('/api/config', (_request, response) => response.json({ expectedContent }));
app.post('/api/run', async (request, response) => {
  if (busy) {
    response.status(409).json({ error: 'Wait for the current streaming experiment.' });
    return;
  }
  try {
    validateMode(request.body?.mode);
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Invalid input.' });
    return;
  }
  busy = true;
  const controller = new AbortController();
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.flushHeaders();
  response.once('close', () => {
    if (!response.writableEnded) controller.abort();
  });
  const send = (type: string, data: unknown) => {
    if (!response.destroyed)
      response.write('event: ' + type + '\ndata: ' + JSON.stringify(data) + '\n\n');
  };
  try {
    const report = {
      id: randomUUID(),
      ...(await runToolStream(
        request.body.mode,
        (event) => send('observation', event),
        controller,
      )),
    };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, file);
    send('complete', report);
  } catch (error) {
    send('failure', { error: error instanceof Error ? error.message : 'Streaming failed.' });
  } finally {
    busy = false;
    response.end();
  }
});
const sources = [
  'src/tool-preview.ts',
  'src/agent.ts',
  'public/app.js',
  'src/server.ts',
  'src/cli.ts',
];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {
    response.status(404).end();
    return;
  }
  response.json({ file, files: sources, content: await readFile(path.join(root, file), 'utf8') });
});
app.get('/api/report/:id', (request, response) => {
  const file = reports.get(String(request.params.id));
  if (!file) {
    response.status(404).end();
    return;
  }
  response.download(file, 'tool-call-streaming-observed-report.json');
});
const port = Number(process.env.PORT || 43133);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 33 lab http://127.0.0.1:${port}`));
