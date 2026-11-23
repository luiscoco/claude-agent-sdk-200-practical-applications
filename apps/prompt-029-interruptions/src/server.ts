import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import 'dotenv/config';
import { InterruptionSession } from './interruption.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
const sessions = new Map<string, InterruptionSession>();
let active: InterruptionSession | undefined;
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
app.post('/api/start', (_request, response) => {
  if (active && !active.snapshot().closed) {
    response
      .status(409)
      .json({ error: 'SESSION_ACTIVE · Close the current experiment before starting another.' });
    return;
  }
  try {
    active = new InterruptionSession();
    sessions.set(active.id, active);
    response.json(active.snapshot());
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Start failed.' });
  }
});
app.get('/api/state/:id', (request, response) => {
  const session = sessions.get(String(request.params.id));
  if (!session) {
    response.status(404).json({ error: 'Unknown session.' });
    return;
  }
  response.json(session.snapshot());
});
app.post('/api/:action/:id', async (request, response) => {
  const session = sessions.get(String(request.params.id));
  if (!session) {
    response.status(404).json({ error: 'SESSION_REQUIRED · Start an experiment.' });
    return;
  }
  try {
    switch (request.params.action) {
      case 'interrupt':
        await session.interrupt();
        break;
      case 'continue':
        session.continue(request.body?.prompt);
        break;
      case 'close':
        session.close();
        await session.done;
        break;
      default:
        response.status(404).end();
        return;
    }
    response.json(session.snapshot());
  } catch (error) {
    response
      .status(422)
      .json({
        error: error instanceof Error ? error.message : 'Session action failed.',
        session: session.snapshot(),
      });
  }
});
app.get('/api/report/:id', async (request, response) => {
  const session = sessions.get(String(request.params.id));
  if (!session) {
    response.status(404).end();
    return;
  }
  const report = session.snapshot();
  const directory = path.join(root, 'runs', report.id);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'report.json');
  await writeFile(file, JSON.stringify(report, null, 2));
  response.download(file, 'interruption-observed-report.json');
});
const sources = ['src/interruption.ts', 'src/queue.ts', 'src/server.ts', 'src/cli.ts'];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {
    response.status(404).end();
    return;
  }
  response.json({ file, files: sources, content: await readFile(path.join(root, file), 'utf8') });
});
const port = Number(process.env.PORT || 43129);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`Prompt 29 lab http://127.0.0.1:${port}`),
);
async function shutdown() {
  for (const session of sessions.values()) session.close();
  await Promise.all([...sessions.values()].map((session) => session.done));
  server.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
