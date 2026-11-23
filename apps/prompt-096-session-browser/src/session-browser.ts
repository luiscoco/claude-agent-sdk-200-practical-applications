import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

const root = path.resolve(import.meta.dirname, '..');
const fixtureRoot = path.join(root, 'fixtures');
// This read-only application never points the SDK at the user's normal Claude configuration.
process.env.CLAUDE_CONFIG_DIR = path.join(fixtureRoot, 'native-config');
const { listSessions, getSessionInfo, getSessionMessages } =
  await import('@anthropic-ai/claude-agent-sdk');
const catalog = JSON.parse(
  (await readFile(path.join(fixtureRoot, 'catalog.json'), 'utf8')).replace(/^\uFEFF/, ''),
);
export const requestSchema = z
  .object({
    selection: z.enum(['switch', 'denied']),
    includeSystem: z.boolean(),
    offset: z.number().int().min(0).max(100),
    pageSize: z.union([z.literal(2), z.literal(4)]),
  })
  .strict();

export async function browseSessions(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  const fixture = catalog.sessions.find((item: any) => item.alias === requestedInput.selection);
  const file = path.join(fixtureRoot, fixture.file);
  const before = await readFile(file);
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const rawRows = before
    .toString('utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  // No query() call: these supported SDK functions read already-persisted local session data.
  const sessions = await listSessions({ includeProgrammatic: true });
  const sessionPage = await listSessions({ limit: 1, offset: 0, includeProgrammatic: true });
  const metadata = await getSessionInfo(fixture.sessionId);
  const messages = await getSessionMessages(fixture.sessionId, {
    includeSystemMessages: requestedInput.includeSystem,
  });
  const messagePage = await getSessionMessages(fixture.sessionId, {
    includeSystemMessages: requestedInput.includeSystem,
    limit: requestedInput.pageSize,
    offset: requestedInput.offset,
  });
  const unknownId = randomUUID();
  const unknownMetadata = await getSessionInfo(unknownId);
  const unknownMessages = await getSessionMessages(unknownId);
  const expectedIds = catalog.sessions.map((item: any) => item.sessionId).sort();
  const checks = {
    bothHistoricalNativeSessionsListed:
      JSON.stringify(sessions.map((item) => item.sessionId).sort()) === JSON.stringify(expectedIds),
    listPaginationMatchesNativeOrder:
      sessionPage.length === 1 && sessionPage[0].sessionId === sessions[0]?.sessionId,
    selectedMetadataMatchesActualSession: metadata?.sessionId === fixture.sessionId,
    actualConversationMessagesReturned:
      messages.length > 0 && messages.every((message) => message.session_id === fixture.sessionId),
    returnedMessagesMatchActualTranscriptRows: messages.every((message) =>
      rawRows.some(
        (row) =>
          row.uuid === message.uuid &&
          row.type === message.type &&
          JSON.stringify(row.message) === JSON.stringify(message.message),
      ),
    ),
    messagePaginationMatchesFullSequence:
      JSON.stringify(messagePage) ===
      JSON.stringify(
        messages.slice(requestedInput.offset, requestedInput.offset + requestedInput.pageSize),
      ),
    missingSessionReturnsNoMetadataOrMessages:
      unknownMetadata === undefined && unknownMessages.length === 0,
    originalFixtureHashMatchesProvenance: hash(before) === fixture.sha256,
    fixtureUnchangedAfterNativeReads: hash(await readFile(file)) === hash(before),
  };
  return {
    requestedInput,
    sessions: sessions.map((item) => ({
      ...item,
      classroomLabel: catalog.sessions.find((fixture: any) => fixture.sessionId === item.sessionId)
        ?.label,
    })),
    selectedMetadata: metadata,
    selectedFixture: {
      alias: fixture.alias,
      label: fixture.label,
      sha256: fixture.sha256,
      sourceEvidence: fixture.sourceEvidence,
    },
    messages: messagePage,
    totalMessages: messages.length,
    output: {
      sessionCount: sessions.length,
      returnedMessages: messagePage.length,
      totalMessages: messages.length,
      userMessages: messages.filter((message) => message.type === 'user').length,
      assistantMessages: messages.filter((message) => message.type === 'assistant').length,
      systemMessages: messages.filter((message) => message.type === 'system').length,
    },
    controls: {
      firstNativeSessionPage: sessionPage.map((item) => item.sessionId),
      unknownSessionId: unknownId,
      unknownMetadataPresent: unknownMetadata !== undefined,
      unknownMessageCount: unknownMessages.length,
    },
    transcriptProof: {
      sha256Before: hash(before),
      rawRowCount: rawRows.length,
      returnedMessageUUIDs: messagePage.map((message) => message.uuid),
    },
    fixtureDisclosure: catalog.disclosure,
    noModelQueriesMade: true,
    checks,
    verified: Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
  };
}
