import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { editSource } from './agent.js';
import { originalLine, editedLine, staleLine } from './source.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
const reports = new Map<string, string>();
const artifacts = new Map<string, string>();
const diffs = new Map<string, string>();
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
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(root, 'public')));
app.get('/api/config', async (_request, response) =>
  response.json({
    source: await readFile(path.join(root, 'fixtures/pricing.ts'), 'utf8'),
    originalLine,
    editedLine,
    staleLine,
  }),
);
app.post('/api/run', async (request, response) => {
  if (busy) {
    response
      .status(409)
      .json({ error: 'Wait for the active targeted-edit experiment to finish.' });
    return;
  }
  busy = true;
  try {
    const report = {
      id: randomUUID(),
      ...(await editSource(request.body?.mode, request.body?.discountCents)),
    };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, file);
    artifacts.set(report.id, report.target);
    const patch = path.join(directory, 'pricing.patch');
    await writeFile(patch, report.diff.stdout, 'utf8');
    diffs.set(report.id, patch);
    response.json(report);
  } catch (error) {
    response.status(422).json({
      error: error instanceof Error ? error.message : 'Targeted-edit experiment failed.',
    });
  } finally {
    busy = false;
  }
});
const sources = [
  'src/agent.ts',
  'src/source.ts',
  'src/server.ts',
  'src/cli.ts',
  'fixtures/pricing.ts',
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
  response.download(file, 'targeted-edit-observed-report.json');
});
app.get('/api/file/:id', (request, response) => {
  const file = artifacts.get(String(request.params.id));
  if (!file) {
    response.status(404).end();
    return;
  }
  response.download(file, 'pricing.ts');
});
app.get('/api/diff/:id', (request, response) => {
  const patch = diffs.get(String(request.params.id));
  if (!patch) {
    response.status(404).end();
    return;
  }
  response.download(patch, 'pricing.patch');
});
const port = Number(process.env.PORT || 43145);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 45 lab http://127.0.0.1:${port}`));
