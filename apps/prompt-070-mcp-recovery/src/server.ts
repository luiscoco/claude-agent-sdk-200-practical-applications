import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { requestSchema } from './recovery.js';
import { runRecovery } from './agent.js';

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
  response.json({ defaultInput: { mode: 'disconnected', pageSize: 5 } }),
);
app.post('/api/run', async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(422)
      .json({ error: 'Select a supported failure mode and a repaired page size from 1 to 10.' });
    return;
  }
  if (busy) {
    response.status(409).json({ error: 'Wait for the active recovery experiment to finish.' });
    return;
  }
  busy = true;
  try {
    const report = { id: randomUUID(), ...(await runRecovery(parsed.data)) };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, file);
    response.json(report);
  } catch (error) {
    let message = error instanceof Error ? error.message : 'Recovery experiment failed.';
    const secret = process.env.ANTHROPIC_API_KEY;
    if (secret) message = message.replaceAll(secret, '[REDACTED]');
    response.status(422).json({ error: message });
  } finally {
    busy = false;
  }
});
const sources = [
  'src/agent.ts',
  'src/mcp-server.mjs',
  'src/recovery.ts',
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
  response.download(file, 'mcp-recovery-observed-report.json');
});
const port = Number(process.env.PORT || 43170);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 70 lab http://127.0.0.1:${port}`));
