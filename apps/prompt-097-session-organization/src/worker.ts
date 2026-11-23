import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { organizationRequest } from './worker-input.js';

const { operation, directory, input } = organizationRequest(process.argv.slice(2));
const ownedRuns = await realpath(path.resolve(import.meta.dirname, '../runs'));
const resolved = await realpath(directory),
  relative = path.relative(ownedRuns, resolved);
if (
  !relative ||
  relative === '..' ||
  relative.startsWith('..' + path.sep) ||
  path.isAbsolute(relative)
)
  throw new Error('Worker directory must be inside owned classroom runs.');
process.env.CLAUDE_CONFIG_DIR = path.join(resolved, 'native-config');
const { renameSession, tagSession, getSessionInfo, getSessionMessages } =
  await import('@anthropic-ai/claude-agent-sdk');
const catalog = JSON.parse(
  (await readFile(path.resolve(import.meta.dirname, '../fixtures/catalog.json'), 'utf8')).replace(
    /^\uFEFF/,
    '',
  ),
);
const sessionId = catalog.sessions[0].sessionId;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const before = await getSessionInfo(sessionId),
  beforeMessages = await getSessionMessages(sessionId);
const operations: Array<Record<string, unknown>> = [];
async function rename(title: string) {
  await renameSession(sessionId, title);
  operations.push({
    utility: 'renameSession',
    requestedValue: title,
    actualMetadata: await getSessionInfo(sessionId),
    completedAt: new Date().toISOString(),
  });
}
async function tag(value: string | null) {
  await tagSession(sessionId, value);
  operations.push({
    utility: 'tagSession',
    requestedValue: value,
    actualMetadata: await getSessionInfo(sessionId),
    completedAt: new Date().toISOString(),
  });
}
if (operation === 'apply') {
  if (input.mode === 'replace') {
    await rename('Draft · ' + input.title);
    await tag('draft');
  }
  await rename(input.title);
  await tag(input.tag);
  if (input.mode === 'clear') await tag(null);
}
const after = await getSessionInfo(sessionId),
  afterMessages = await getSessionMessages(sessionId);
console.log(
  JSON.stringify({
    pid: process.pid,
    operation,
    sessionId,
    before,
    operations,
    after,
    conversationMessageCount: afterMessages.length,
    beforeMessageHash: digest(beforeMessages),
    afterMessageHash: digest(afterMessages),
    conversationUUIDs: afterMessages.map((message) => message.uuid),
    conversationUnchanged: digest(beforeMessages) === digest(afterMessages),
  }),
);
