import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runContextUsage } from './agent.js';
import { requestSchema } from './context-view.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express(),
  reports = new Map<string, string>();
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
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(root, 'public')));
app.post('/api/run', async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({
      error: 'Choose a supported context profile and classroom topic.',
    });
    return;
  }
  try {
    const report = { id: randomUUID(), ...(await runContextUsage(parsed.data)) };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, file);
    response.json(report);
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : String(error) });
  }
});
const sources = [
  'src/agent.ts',
  'src/native-context.ts',
  'src/context-view.ts',
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
  response.download(file, 'context-usage-observed-report.json');
});
const port = Number(process.env.PORT || 43201);
app.listen(port, '127.0.0.1', (error?: Error) => {
  if (error) {
    console.error('Unable to start the local app: ' + error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`Prompt 101 lab http://127.0.0.1:${port}`);
});
