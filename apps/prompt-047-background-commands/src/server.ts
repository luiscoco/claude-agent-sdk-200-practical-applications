import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import 'dotenv/config';
import { BackgroundSession } from './background.js';
const root = path.resolve(import.meta.dirname, '..');
const app = express();
const sessions = new Map<string, BackgroundSession>();
let active: BackgroundSession | undefined;
let starting = false;
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
    completionDurationMs: 6000,
    cancellationDurationMs: 20000,
    nativeBackgroundTimeoutMs: 60000,
  }),
);
app.post('/api/start', async (request, response) => {
  if (starting) {
    response
      .status(409)
      .json({ error: 'SESSION_ACTIVE · Wait for the active background experiment to finish.' });
    return;
  }
  starting = true;
  try {
    if (active && !(await active.snapshot()).closed) {
      response
        .status(409)
        .json({ error: 'SESSION_ACTIVE · Wait for the active background experiment to finish.' });
      return;
    }
    active = await BackgroundSession.create(request.body?.mode);
    sessions.set(active.id, active);
    response.json(await active.snapshot());
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : 'Start failed.' });
  } finally {
    starting = false;
  }
});
app.get('/api/state/:id', async (request, response) => {
  const session = sessions.get(String(request.params.id));
  if (!session) {
    response.status(404).json({ error: 'Unknown session.' });
    return;
  }
  response.json(await session.snapshot());
});
app.post('/api/cancel/:id', async (request, response) => {
  const session = sessions.get(String(request.params.id));
  if (!session) {
    response.status(404).json({ error: 'SESSION_REQUIRED · Start an experiment.' });
    return;
  }
  try {
    await session.cancel();
    response.json(await session.snapshot());
  } catch (error) {
    response.status(422).json({
      error: error instanceof Error ? error.message : 'Cancellation failed.',
      session: await session.snapshot(),
    });
  }
});
app.get('/api/report/:id', async (request, response) => {
  const session = sessions.get(String(request.params.id));
  if (!session) {
    response.status(404).end();
    return;
  }
  const report = await session.snapshot();
  const directory = path.join(root, 'runs', report.id);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'report.json');
  await writeFile(file, JSON.stringify(report, null, 2));
  response.download(file, 'background-command-observed-report.json');
});
const sources = [
  'src/background.ts',
  'src/command.ts',
  'src/queue.ts',
  'src/server.ts',
  'src/cli.ts',
  'fixtures/background-check.mjs',
];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {
    response.status(404).end();
    return;
  }
  response.json({ file, files: sources, content: await readFile(path.join(root, file), 'utf8') });
});
const port = Number(process.env.PORT || 43147);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`Prompt 47 lab http://127.0.0.1:${port}`),
);
async function shutdown() {
  for (const session of sessions.values()) session.close();
  await Promise.all([...sessions.values()].map((session) => session.done));
  server.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
