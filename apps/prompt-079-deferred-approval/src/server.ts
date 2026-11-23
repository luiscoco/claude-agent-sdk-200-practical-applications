import express from 'express';
import path from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import { z } from 'zod';
import 'dotenv/config';
import { deferRun, resumeRun, topicSchema, decisionSchema } from './agent.js';
import { loadRun, root } from './store.js';
import { publicReport } from './privacy.js';

const app = express();
let activeWorker = false;
app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  );
  response.setHeader('Cache-Control', 'no-store');
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
function safeError(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  return message;
}
const sanitized = (state: unknown) => publicReport(state, [process.env.ANTHROPIC_API_KEY]);
app.get('/api/config', async (_request, response) => {
  const entries = await readdir(path.join(root, 'runs'), { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !z.string().uuid().safeParse(entry.name).success) continue;
    const file = path.join(root, 'runs', entry.name, 'state.json');
    const metadata = await stat(file).catch(() => null);
    if (metadata) candidates.push({ id: entry.name, modified: metadata.mtimeMs });
  }
  candidates.sort((a, b) => b.modified - a.modified);
  response.json({ activeWorker, latestRunId: candidates[0]?.id ?? null });
});
app.get('/api/runs/:id', async (request, response) => {
  if (!z.string().uuid().safeParse(request.params.id).success) {
    response.status(422).json({ error: 'Use the actual saved run UUID.' });
    return;
  }
  try {
    response.json(sanitized(await loadRun(request.params.id)));
  } catch {
    response.status(404).json({ error: 'Saved classroom run unavailable.' });
  }
});
app.post('/api/defer', async (request, response) => {
  const parsed = z.object({ topic: topicSchema }).strict().safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: 'Choose the MCP or Hooks classroom topic.' });
    return;
  }
  if (activeWorker) {
    response.status(409).json({ error: 'Wait for the active native worker to stop.' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    response
      .status(422)
      .json({ error: 'MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.' });
    return;
  }
  activeWorker = true;
  try {
    response.json(sanitized(await deferRun(parsed.data.topic)));
  } catch (error) {
    response.status(500).json({ error: safeError(error) });
  } finally {
    activeWorker = false;
  }
});
app.post('/api/resume', async (request, response) => {
  const parsed = z
    .object({ id: z.string().uuid(), decision: decisionSchema })
    .strict()
    .safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: 'Send the saved run UUID and approve or deny.' });
    return;
  }
  if (activeWorker) {
    response.status(409).json({ error: 'Wait for the active native worker to stop.' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    response
      .status(422)
      .json({ error: 'MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.' });
    return;
  }
  activeWorker = true;
  try {
    response.json(sanitized(await resumeRun(parsed.data.id, parsed.data.decision)));
  } catch (error) {
    response.status(409).json({ error: safeError(error) });
  } finally {
    activeWorker = false;
  }
});
app.get('/api/report/:id', async (request, response) => {
  try {
    const state = await loadRun(request.params.id);
    response.attachment('deferred-approval-observed-report.json').json(sanitized(state));
  } catch {
    response.status(404).json({ error: 'Saved classroom report unavailable.' });
  }
});
const sources = ['src/agent.ts', 'src/store.ts', 'src/server.ts', 'src/cli.ts'];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {
    response.status(404).end();
    return;
  }
  response.json({ file, files: sources, content: await readFile(path.join(root, file), 'utf8') });
});
const port = Number(process.env.PORT || 43179);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 79 lab http://127.0.0.1:${port}`));
