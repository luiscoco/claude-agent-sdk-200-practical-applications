import path from 'node:path';
import { readFile, realpath, access } from 'node:fs/promises';
import { z } from 'zod';
import { requestSchema, planRetention } from './retention.js';
const operation = z.enum(['apply', 'reload']).parse(process.argv[2]);
const input = requestSchema.parse(JSON.parse(process.argv[4] || '{}'));
const ownedRoot = await realpath(path.resolve(import.meta.dirname, '../runs'));
const workspace = await realpath(process.argv[3] || '');
const relative = path.relative(ownedRoot, workspace);
if (
  !relative ||
  relative === '..' ||
  relative.startsWith('..' + path.sep) ||
  path.isAbsolute(relative)
)
  throw new Error('Deletion workspace must be inside owned classroom runs.');
const config = await realpath(path.join(workspace, 'native-config'));
process.env.CLAUDE_CONFIG_DIR = config;
const { listSessions, getSessionInfo, getSessionMessages, deleteSession } =
  await import('@anthropic-ai/claude-agent-sdk');
const catalog = JSON.parse(
  (await readFile(path.resolve(import.meta.dirname, '../fixtures/catalog.json'), 'utf8')).replace(
    /^\uFEFF/,
    '',
  ),
);
const target = catalog.sessions[0],
  ownedIds = new Set<string>(catalog.sessions.map((item: any) => item.sessionId));
const before = await listSessions();
const cutoff = Date.now() - input.retentionHours * 3600000;
const plan = planRetention(
  before,
  cutoff,
  new Set(input.mode === 'protect' ? [target.sessionId] : []),
  ownedIds,
);
const deleted: string[] = [],
  errors: string[] = [];
if (operation === 'apply' && input.mode !== 'dry-run') {
  for (const candidate of plan.filter((item) => item.eligible)) {
    const fixture = catalog.sessions.find((item: any) => item.sessionId === candidate.sessionId);
    const transcript = await realpath(path.join(workspace, fixture.file));
    const bound = path.relative(config, transcript);
    if (bound === '..' || bound.startsWith('..' + path.sep) || path.isAbsolute(bound))
      throw new Error('Native deletion target escaped the owned configuration.');
    try {
      await deleteSession(candidate.sessionId);
      deleted.push(candidate.sessionId);
    } catch (failure) {
      errors.push(failure instanceof Error ? failure.message : String(failure));
    }
  }
}
let repeatDeletion = { attempted: false, rejected: false, error: '' };
if (deleted.includes(target.sessionId)) {
  repeatDeletion.attempted = true;
  try {
    await deleteSession(target.sessionId);
  } catch (failure) {
    repeatDeletion.rejected = true;
    repeatDeletion.error = failure instanceof Error ? failure.message : String(failure);
  }
}
const present = async (file: string) => {
  try {
    await access(file);
    return true;
  } catch (failure) {
    if ((failure as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw failure;
  }
};
const targetFile = path.join(workspace, target.file);
const sessionDirectory = path.join(path.dirname(targetFile), target.sessionId);
const metadata = await getSessionInfo(target.sessionId),
  messages = await getSessionMessages(target.sessionId);
console.log(
  JSON.stringify({
    pid: process.pid,
    operation,
    cutoff,
    before,
    plan,
    deleted,
    errors,
    repeatDeletion,
    after: await listSessions(),
    targetMetadata: metadata ?? null,
    targetMessageCount: messages.length,
    artifacts: {
      targetTranscript: await present(targetFile),
      sessionSubdirectory: await present(sessionDirectory),
      applicationReference: await present(path.join(workspace, 'application-reference.json')),
      workspaceNote: await present(path.join(workspace, 'workspace/owned-note.txt')),
    },
  }),
);
