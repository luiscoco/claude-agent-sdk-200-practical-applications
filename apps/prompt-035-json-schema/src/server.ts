import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { runSchema } from './agent.js';
import { prepareTask, selectSchema } from './schema.js';

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
app.get('/api/config', (_request, response) =>
  response.json({ tasks: ['basics', 'streaming'].map(prepareTask), schema: selectSchema('valid') }),
);
app.post('/api/run', async (request, response) => {
  if (busy) {
    response
      .status(409)
      .json({ error: 'Wait for the active structured-output experiment to finish.' });
    return;
  }
  busy = true;
  try {
    const report = {
      id: randomUUID(),
      ...(await runSchema(request.body?.mode, request.body?.task)),
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
      .json({
        error: error instanceof Error ? error.message : 'Structured-output experiment failed.',
      });
  } finally {
    busy = false;
  }
});
const sources = ['src/schema.ts', 'src/agent.ts', 'src/server.ts', 'src/cli.ts'];
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
  response.download(file, 'json-schema-observed-report.json');
});
const port = Number(process.env.PORT || 43135);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 35 lab http://127.0.0.1:${port}`));
