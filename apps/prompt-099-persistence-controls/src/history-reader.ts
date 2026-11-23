import path from 'node:path';
import { readFile, realpath, readdir, access } from 'node:fs/promises';
const workspace = await realpath(process.argv[2] || ''),
  root = await realpath(path.resolve(import.meta.dirname, '../runs'));
const relative = path.relative(root, workspace);
if (
  !relative ||
  relative === '..' ||
  relative.startsWith('..' + path.sep) ||
  path.isAbsolute(relative)
)
  throw new Error('History reader must stay inside owned classroom runs.');
const sessionId = process.argv[3],
  promptId = process.argv[4],
  marker = process.argv[5];
process.env.CLAUDE_CONFIG_DIR = path.join(workspace, 'native-config');
const { listSessions, getSessionInfo, getSessionMessages } =
  await import('@anthropic-ai/claude-agent-sdk');
const files = await readdir(workspace, { recursive: true }),
  transcripts = [];
for (const file of files.filter((file) => file.endsWith('.jsonl'))) {
  const rows = (await readFile(path.join(workspace, file), 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  transcripts.push({
    file,
    exactUserAppendFound: rows.some(
      (row) =>
        row.type === 'user' &&
        row.uuid === promptId &&
        row.sessionId === sessionId &&
        JSON.stringify(row.message).includes(marker),
    ),
  });
}
let noteRemains = false;
try {
  await access(path.join(workspace, 'owned-note.txt'));
  noteRemains = true;
} catch (failure) {
  if ((failure as NodeJS.ErrnoException).code !== 'ENOENT') throw failure;
}
const messages = await getSessionMessages(sessionId);
console.log(
  JSON.stringify({
    pid: process.pid,
    transcripts,
    listedNativeIds: (await listSessions()).map((item) => item.sessionId),
    nativeMetadata: (await getSessionInfo(sessionId)) ?? null,
    nativeMessages: messages,
    exactMarkerFoundByNativeReader: messages.some(
      (message) => message.uuid === promptId && JSON.stringify(message.message).includes(marker),
    ),
    noteRemains,
  }),
);
