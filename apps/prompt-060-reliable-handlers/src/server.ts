import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { runReliableHandler } from './agent.js';
import {
  createOperationControl,
  requestCancellation,
  scenarios,
  type OperationControl,
} from './handler.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
const reports = new Map<string, string>();
let active: OperationControl | null = null;
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
  response.json({
    defaultInput: { mode: 'retry-after-timeout', label: 'Classroom booking' },
    scenarios,
  }),
);
app.get('/api/status', (_request, response) =>
  response.json({
    busy: Boolean(active),
    controlId: active?.id ?? null,
    phase: active?.phase ?? 'idle',
    canCancel:
      active?.mode === 'cancel' && active.phase === 'waiting' && !active.abort.signal.aborted,
  }),
);
app.post('/api/cancel', (request, response) => {
  if (!active || request.body?.controlId !== active.id) {
    response.status(409).json({ error: 'The active classroom request changed.' });
    return;
  }
  if (!requestCancellation(active)) {
    response
      .status(409)
      .json({
        error: 'Select the cancellation scenario and wait for its API request to be accepted.',
      });
    return;
  }
  response.status(202).json({ cancellationRequested: true, controlId: active.id });
});
app.post('/api/run', async (request, response) => {
  if (active) {
    response.status(409).json({ error: 'Wait for the active reliability experiment to finish.' });
    return;
  }
  const control = createOperationControl();
  active = control;
  try {
    const report = { id: randomUUID(), ...(await runReliableHandler(request.body, control)) };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, file);
    response.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reliability experiment failed.';
    response
      .status(422)
      .json({
        error: process.env.ANTHROPIC_API_KEY
          ? message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]')
          : message,
      });
  } finally {
    if (active?.id === control.id) active = null;
  }
});
const sources = [
  'src/agent.ts',
  'src/handler.ts',
  'src/classroom-api.ts',
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
  response.download(file, 'reliable-handler-observed-report.json');
});
const port = Number(process.env.PORT || 43160);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 60 lab http://127.0.0.1:${port}`));
