import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { runCleanup } from './cleanup.js';

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
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(root, 'public')));
app.post('/api/run', async (request, response) => {
  if (busy) {
    response.status(409).json({ error: 'Wait for the active cleanup experiment to finish.' });
    return;
  }
  busy = true;
  try {
    const mode = request.body?.mode;
    const modes = mode === 'compare' ? ['success', 'cancel', 'exception'] : [mode];
    const results = [];
    for (const selected of modes) results.push(await runCleanup(selected));
    const report = {
      id: randomUUID(),
      mode,
      reports: results,
      verified: results.every((item) => item.verified),
    };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, file);
    response.json(report);
  } catch (error) {
    response
      .status(422)
      .json({ error: error instanceof Error ? error.message : 'Cleanup experiment failed.' });
  } finally {
    busy = false;
  }
});
const sources = ['src/cleanup.ts', 'src/process-tracker.ts', 'src/server.ts', 'src/cli.ts'];
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
  response.download(file, 'resource-cleanup-observed-report.json');
});
const port = Number(process.env.PORT || 43130);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 30 lab http://127.0.0.1:${port}`));
