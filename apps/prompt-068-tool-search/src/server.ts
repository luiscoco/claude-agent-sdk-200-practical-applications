import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { requestSchema } from './search.js';
import { runSearch } from './agent.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
const reports = new Map<string, string>();
const comparisons = new Map<string, { lessonId: number; summary: Record<string, unknown> }>();
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
  response.json({ defaultInput: { mode: 'low-threshold', lessonId: 17 } }),
);
app.post('/api/run', async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response
      .status(422)
      .json({
        error: 'Select a supported search mode and a classroom lesson number from 1 to 48.',
      });
    return;
  }
  if (busy) {
    response.status(409).json({ error: 'Wait for the active tool-search experiment to finish.' });
    return;
  }
  busy = true;
  try {
    const report = { id: randomUUID(), ...(await runSearch(parsed.data)) };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, file);
    comparisons.set(`${parsed.data.lessonId}/${parsed.data.mode}`, {
      lessonId: parsed.data.lessonId,
      summary: {
        id: report.id,
        mode: parsed.data.mode,
        lessonId: parsed.data.lessonId,
        checkedAt: report.checkedAt,
        searchSetting: report.searchSetting,
        beforeMetrics: report.beforeMetrics,
        afterMetrics: report.afterMetrics,
        measurements: report.measurements,
        searchCalls: report.calls.filter((call: { name: string }) => call.name === 'ToolSearch')
          .length,
        verified: report.verified,
      },
    });
    response.json(report);
  } catch (error) {
    let message = error instanceof Error ? error.message : 'Tool-search experiment failed.';
    const secret = process.env.ANTHROPIC_API_KEY;
    if (secret) message = message.replaceAll(secret, '[REDACTED]');
    response.status(422).json({ error: message });
  } finally {
    busy = false;
  }
});
app.get('/api/comparisons', (request, response) => {
  const lessonId = Number(request.query.lessonId || 17);
  if (!Number.isInteger(lessonId) || lessonId < 1 || lessonId > 48) {
    response.status(422).json({ error: 'Select a classroom lesson from 1 to 48.' });
    return;
  }
  response.json(
    [...comparisons.values()]
      .filter((entry) => entry.lessonId === lessonId)
      .map((entry) => entry.summary),
  );
});
const sources = [
  'src/agent.ts',
  'src/mcp-server.mjs',
  'src/search.ts',
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
  response.download(file, 'tool-search-observed-report.json');
});
const port = Number(process.env.PORT || 43168);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 68 lab http://127.0.0.1:${port}`));
