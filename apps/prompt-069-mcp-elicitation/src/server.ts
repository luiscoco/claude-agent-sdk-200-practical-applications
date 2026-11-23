import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import 'dotenv/config';
import { ClassroomQuestions } from './questions.js';
import { runInteraction } from './agent.js';
import { publicReport } from './privacy.js';

type Job = {
  id: string;
  status: 'running' | 'cancelling' | 'complete' | 'failed' | 'cancelled';
  questions: ClassroomQuestions;
  controller: AbortController;
  report?: Awaited<ReturnType<typeof runInteraction>>;
  file?: string;
  error: string;
};
const root = path.resolve(import.meta.dirname, '..');
const app = express();
const jobs = new Map<string, Job>();
let activeId = '',
  latestId = '';
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
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(root, 'public')));
function messageFor(error: unknown) {
  let text = error instanceof Error ? error.message : 'Classroom interaction failed.';
  if (process.env.ANTHROPIC_API_KEY)
    text = text.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  return text;
}
app.get('/api/config', (_request, response) =>
  response.json({ activeJobId: activeId || null, latestJobId: latestId || null }),
);
app.post('/api/start', (request, response) => {
  if (!z.object({}).strict().safeParse(request.body).success) {
    response
      .status(422)
      .json({ error: 'Start this classroom interaction with an empty request object.' });
    return;
  }
  if (activeId) {
    response.status(409).json({ error: 'Answer or cancel the current classroom run first.' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    response
      .status(422)
      .json({ error: 'MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.' });
    return;
  }
  const job: Job = {
    id: randomUUID(),
    status: 'running',
    questions: new ClassroomQuestions(),
    controller: new AbortController(),
    error: '',
  };
  jobs.set(job.id, job);
  activeId = job.id;
  latestId = job.id;
  void (async () => {
    try {
      const report = { id: job.id, ...(await runInteraction(job.questions, job.controller)) };
      const directory = path.join(root, 'runs', job.id);
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, 'report.json');
      await writeFile(file, JSON.stringify(report, null, 2));
      job.report = report;
      job.file = file;
      job.status = job.controller.signal.aborted ? 'cancelled' : 'complete';
    } catch (error) {
      job.error = messageFor(error);
      job.status = job.controller.signal.aborted ? 'cancelled' : 'failed';
    } finally {
      job.questions.cancel();
      if (activeId === job.id) activeId = '';
    }
  })();
  response.status(202).json({ id: job.id });
});
app.get('/api/jobs/:id', (request, response) => {
  const job = jobs.get(String(request.params.id));
  if (!job) {
    response.status(404).end();
    return;
  }
  response.json(
    publicReport(
      {
        id: job.id,
        status: job.status,
        pending: job.questions.current(),
        questions: job.questions.history,
        report: job.report ?? null,
        error: job.error,
      },
      [process.env.ANTHROPIC_API_KEY],
    ),
  );
});
app.post('/api/jobs/:id/answer', (request, response) => {
  const job = jobs.get(String(request.params.id));
  if (!job) {
    response.status(404).end();
    return;
  }
  if (job.status !== 'running') {
    response.status(409).json({ error: 'This classroom run is no longer awaiting answers.' });
    return;
  }
  const parsed = z
    .object({ questionId: z.string().uuid(), answer: z.unknown() })
    .strict()
    .safeParse(request.body);
  if (!parsed.success) {
    response
      .status(422)
      .json({ error: 'Send the current question identifier and its structured answer.' });
    return;
  }
  const pending = job.questions.current();
  if (!pending || pending.id !== parsed.data.questionId) {
    response.status(409).json({ error: 'This classroom request is no longer pending.' });
    return;
  }
  try {
    response.json(job.questions.answer(parsed.data.questionId, parsed.data.answer));
  } catch (error) {
    response.status(422).json({ error: messageFor(error) });
  }
});
app.post('/api/jobs/:id/cancel', (request, response) => {
  const job = jobs.get(String(request.params.id));
  if (!job) {
    response.status(404).end();
    return;
  }
  if (job.status === 'running') {
    job.status = 'cancelling';
    job.controller.abort();
    job.questions.cancel();
  }
  response.json({ id: job.id, status: job.status });
});
app.get('/api/report/:id', (request, response) => {
  const job = jobs.get(String(request.params.id));
  if (!job?.file) {
    response.status(404).end();
    return;
  }
  response.download(job.file, 'mcp-elicitation-observed-report.json');
});
const sources = [
  'src/agent.ts',
  'src/questions.ts',
  'src/mcp-server.mjs',
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
const port = Number(process.env.PORT || 43169);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 69 lab http://127.0.0.1:${port}`));
