import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { editNotebook } from './agent.js';
const root = path.resolve(import.meta.dirname, '..');
const app = express();
const reports = new Map<string, string>();
const notebooks = new Map<string, string>();
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
    notebook: JSON.parse(await readFile(path.join(root, 'fixtures/checkout.ipynb'), 'utf8')),
    selectedCellId: 'pricing-cell',
  }),
);
app.post('/api/run', async (request, response) => {
  if (busy) {
    response.status(409).json({ error: 'Wait for the active notebook experiment to finish.' });
    return;
  }
  busy = true;
  try {
    const report = { id: randomUUID(), ...(await editNotebook(request.body?.mode)) };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, file);
    notebooks.set(report.id, report.target);
    response.json(report);
  } catch (error) {
    response
      .status(422)
      .json({ error: error instanceof Error ? error.message : 'Notebook experiment failed.' });
  } finally {
    busy = false;
  }
});
const sources = [
  'src/agent.ts',
  'src/notebook.ts',
  'src/server.ts',
  'src/cli.ts',
  'fixtures/checkout.ipynb',
  'fixtures/verify-notebook.py',
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
  response.download(file, 'notebook-edit-observed-report.json');
});
app.get('/api/notebook/:id', (request, response) => {
  const file = notebooks.get(String(request.params.id));
  if (!file) {
    response.status(404).end();
    return;
  }
  response.download(file, 'checkout.ipynb');
});
const port = Number(process.env.PORT || 43148);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 48 lab http://127.0.0.1:${port}`));
