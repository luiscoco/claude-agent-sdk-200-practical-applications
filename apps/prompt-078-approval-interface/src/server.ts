import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import 'dotenv/config';
import { requestSchema } from './approval.js';
import { ClassroomQuestions } from './questions.js';
import { runApproval } from './agent.js';
import { publicReport } from './privacy.js';
import {
  ClassroomSessions,
  cookieToken,
  ownsJob,
  type ClassroomSession,
  type JobOwner,
} from './auth.js';

type Job = {
  id: string;
  owner: JobOwner;
  requestedInput: z.infer<typeof requestSchema>;
  status: 'running' | 'cancelling' | 'complete' | 'failed' | 'cancelled';
  questions: ClassroomQuestions;
  controller: AbortController;
  report?: Awaited<ReturnType<typeof runApproval>> & { id: string; owner: JobOwner };
  file?: string;
  error: string;
};
const root = path.resolve(import.meta.dirname, '..');
const app = express(),
  sessions = new ClassroomSessions(),
  jobs = new Map<string, Job>();
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
function currentSession(request: Request) {
  return sessions.get(cookieToken(request.headers.cookie));
}
function requireSession(request: Request, response: Response) {
  const session = currentSession(request);
  if (!session) response.status(401).json({ error: 'Choose a classroom identity to continue.' });
  return session;
}
function ownedJob(request: Request, response: Response) {
  const session = requireSession(request, response);
  if (!session) return null;
  const job = jobs.get(String(request.params.id));
  if (!job || !ownsJob(job.owner, session)) {
    response.status(404).json({ error: 'This run is unavailable for your classroom session.' });
    return null;
  }
  return job;
}
function cancelSessionJobs(session: ClassroomSession) {
  for (const job of jobs.values()) {
    if (ownsJob(job.owner, session) && job.status === 'running') {
      job.status = 'cancelling';
      job.controller.abort();
      job.questions.cancel();
    }
  }
}
function safeMessage(error: unknown) {
  let message = error instanceof Error ? error.message : 'Classroom approval failed.';
  if (process.env.ANTHROPIC_API_KEY)
    message = message.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  return message;
}
app.get('/api/session', (request, response) => response.json({ viewer: currentSession(request) }));
app.post('/api/session/login', (request, response) => {
  const parsed = z
    .object({ userId: z.enum(['learner-a', 'learner-b']) })
    .strict()
    .safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: 'Choose Classroom Learner A or B.' });
    return;
  }
  const previous = sessions.revoke(cookieToken(request.headers.cookie));
  if (previous) cancelSessionJobs(previous);
  const { token, session } = sessions.create(parsed.data.userId);
  response.cookie('classroom_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 3600000,
  });
  response.json({ viewer: session });
});
app.post('/api/session/logout', (request, response) => {
  const session = sessions.revoke(cookieToken(request.headers.cookie));
  if (session) cancelSessionJobs(session);
  response.clearCookie('classroom_session', { httpOnly: true, sameSite: 'strict', path: '/' });
  response.json({ loggedOut: true });
});
app.get('/api/config', (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  const own = [...jobs.values()].filter((job) => ownsJob(job.owner, session));
  const active = own.find((job) => job.status === 'running' || job.status === 'cancelling');
  response.json({
    viewer: session,
    activeJobId: active?.id ?? null,
    latestJobId: own.at(-1)?.id ?? null,
  });
});
app.post('/api/start', (request, response) => {
  const session = requireSession(request, response);
  if (!session) return;
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(422).json({ error: 'Choose MCP or Hooks as the classroom topic.' });
    return;
  }
  if (
    [...jobs.values()].some(
      (job) => ownsJob(job.owner, session) && ['running', 'cancelling'].includes(job.status),
    )
  ) {
    response
      .status(409)
      .json({ error: 'Answer or cancel the active run in this classroom session.' });
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
    owner: { userId: session.userId, sessionId: session.id, displayName: session.displayName },
    requestedInput: parsed.data,
    status: 'running',
    questions: new ClassroomQuestions(),
    controller: new AbortController(),
    error: '',
  };
  jobs.set(job.id, job);
  void (async () => {
    try {
      const report = {
        id: job.id,
        owner: job.owner,
        ...(await runApproval(job.questions, job.controller, job.requestedInput)),
      };
      const directory = path.join(root, 'runs', job.id);
      await mkdir(directory, { recursive: true });
      job.file = path.join(directory, 'report.json');
      await writeFile(
        job.file,
        JSON.stringify(publicReport(report, [process.env.ANTHROPIC_API_KEY]), null, 2),
      );
      job.report = report;
      job.status = job.controller.signal.aborted ? 'cancelled' : 'complete';
    } catch (error) {
      job.error = safeMessage(error);
      job.status = job.controller.signal.aborted ? 'cancelled' : 'failed';
    } finally {
      job.questions.cancel();
    }
  })();
  response.status(202).json({ id: job.id });
});
app.get('/api/jobs/:id', (request, response) => {
  const job = ownedJob(request, response);
  if (!job) return;
  response.json(
    publicReport(
      {
        id: job.id,
        owner: job.owner,
        requestedInput: job.requestedInput,
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
  const job = ownedJob(request, response);
  if (!job) return;
  if (job.status !== 'running') {
    response.status(409).json({ error: 'This run is no longer awaiting approval.' });
    return;
  }
  const parsed = z
    .object({ questionId: z.string().uuid(), answer: z.unknown() })
    .strict()
    .safeParse(request.body);
  if (!parsed.success) {
    response
      .status(422)
      .json({ error: 'Send the current question identifier and structured answer.' });
    return;
  }
  if (job.questions.current()?.id !== parsed.data.questionId) {
    response.status(409).json({ error: 'This approval is no longer pending.' });
    return;
  }
  try {
    response.json(job.questions.answer(parsed.data.questionId, parsed.data.answer));
  } catch (error) {
    response.status(422).json({ error: safeMessage(error) });
  }
});
app.post('/api/jobs/:id/cancel', (request, response) => {
  const job = ownedJob(request, response);
  if (!job) return;
  if (job.status === 'running') {
    job.status = 'cancelling';
    job.controller.abort();
    job.questions.cancel();
  }
  response.json({ id: job.id, status: job.status });
});
app.get('/api/report/:id', (request, response) => {
  const job = ownedJob(request, response);
  if (!job) return;
  if (!job.file) {
    response.status(404).json({ error: 'The observed report is still pending.' });
    return;
  }
  response.download(job.file, 'session-approval-observed-report.json');
});
const sources = [
  'src/agent.ts',
  'src/questions.ts',
  'src/approval.ts',
  'src/auth.ts',
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
const port = Number(process.env.PORT || 43178);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 78 lab http://127.0.0.1:${port}`));
