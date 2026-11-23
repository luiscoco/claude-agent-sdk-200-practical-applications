import path from 'node:path';
import { realpath } from 'node:fs/promises';
const input = JSON.parse(process.argv[2] || '{}');
const ownedRoot = await realpath(path.resolve(import.meta.dirname, '../runs'));
const config = await realpath(input.nativeConfigDirectory),
  relative = path.relative(ownedRoot, config);
if (
  !relative ||
  relative === '..' ||
  relative.startsWith('..' + path.sep) ||
  path.isAbsolute(relative)
)
  throw new Error('History reader must stay inside owned classroom configuration.');
process.env.CLAUDE_CONFIG_DIR = config;
const { listSessions, getSessionMessages } = await import('@anthropic-ai/claude-agent-sdk');
const eligible = await listSessions({ dir: input.queryDirectory, includeWorktrees: false });
const sessions = [];
for (const sessionId of input.sessionIds)
  sessions.push({ sessionId, messages: await getSessionMessages(sessionId) });
console.log(
  JSON.stringify({
    pid: process.pid,
    eligibleSessionsInQueryDirectory: eligible,
    latestEligibleSessionId: eligible[0]?.sessionId ?? null,
    sessions,
  }),
);
