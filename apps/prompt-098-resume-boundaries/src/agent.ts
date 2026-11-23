import path from 'node:path';
import { mkdir, mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendContext } from './append.js';
import { requestSchema } from './boundaries.js';
import { publicReport } from './privacy.js';
const root = path.resolve(import.meta.dirname, '..');
async function history(input: unknown) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'src/history-reader.ts', JSON.stringify(input)],
      { cwd: root, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '',
      stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (text) => (stdout += text));
    child.stderr.on('data', (text) => (stderr += text));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error('Native boundary history reader failed: ' + stderr));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error('Native boundary history reader returned invalid JSON.'));
      }
    });
  });
}
export async function runBoundary(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/boundary-')),
    nativeConfigDirectory = path.join(workspace, 'native-config');
  const nonce = randomBytes(4).toString('hex').toUpperCase();
  const markers = ['A', 'B', 'C'].map((label) => `BOUNDARY_${label}_${nonce}`);
  const seedRuns: Array<Record<string, any>> = [];
  for (const [index, marker] of markers.entries()) {
    const run = await appendContext(
      workspace,
      nativeConfigDirectory,
      `Owned ${requestedInput.topic} classroom context ${index + 1}: ${marker}.`,
      index === 0 ? { kind: 'new' } : { kind: 'resume', sessionId: seedRuns[0].actualSessionId },
    );
    seedRuns.push(run);
    if (!run.success) throw new Error(run.error || 'Native context append failed.');
  }
  const sourceSessionId = seedRuns[0].actualSessionId;
  const before = await history({
    nativeConfigDirectory,
    queryDirectory: workspace,
    sessionIds: [sourceSessionId],
  });
  const sourceMessages = before.sessions[0].messages;
  const supportedBoundaries = sourceMessages.filter((message: any) => message.type === 'assistant');
  const selectedBoundary =
    requestedInput.mode === 'full'
      ? null
      : supportedBoundaries[requestedInput.mode === 'first' ? 0 : 1];
  if (requestedInput.mode !== 'full' && !selectedBoundary)
    throw new Error('Expected native pending-context placeholder boundary was not observed.');
  const sourcePrefix = selectedBoundary
    ? sourceMessages.slice(
        0,
        sourceMessages.findIndex((message: any) => message.uuid === selectedBoundary.uuid) + 1,
      )
    : sourceMessages;
  const noteText =
    'Owned host-created workspace state after the third context. Conversation boundaries do not rewind this file.';
  await writeFile(path.join(workspace, 'owned-note.txt'), noteText);
  const followUp = `Owned ${requestedInput.topic} boundary follow-up. Keep the selected earlier context; no original marker values are repeated here.`;
  const fork = await appendContext(workspace, nativeConfigDirectory, followUp, {
    kind: 'fork',
    sessionId: sourceSessionId,
    ...(selectedBoundary ? { boundary: selectedBoundary.uuid } : {}),
  });
  if (!fork.actualSessionId) throw new Error(fork.error || 'Native fork did not initialize.');
  const after = await history({
    nativeConfigDirectory,
    queryDirectory: workspace,
    sessionIds: [sourceSessionId, fork.actualSessionId],
  });
  const originalAfter = after.sessions.find(
    (session: any) => session.sessionId === sourceSessionId,
  ).messages;
  const forkMessages = after.sessions.find(
    (session: any) => session.sessionId === fork.actualSessionId,
  ).messages;
  const view = (messages: any[]) =>
    messages.map((message) => ({
      uuid: message.uuid,
      type: message.type,
      message: message.message,
    }));
  const digest = (messages: any[]) =>
    createHash('sha256')
      .update(JSON.stringify(view(messages)))
      .digest('hex');
  const expectedMarkers = markers.map(
    (_marker, index) =>
      requestedInput.mode === 'full' || index <= (requestedInput.mode === 'first' ? 0 : 1),
  );
  const actualMarkers = markers.map((marker) => JSON.stringify(forkMessages).includes(marker));
  const files = await readdir(workspace, { recursive: true });
  const rawForkFile = files.find((file) => file.endsWith(fork.actualSessionId + '.jsonl'));
  const rawFork = rawForkFile ? await readFile(path.join(workspace, rawForkFile), 'utf8') : '';
  const allRuns = [...seedRuns, fork];
  const checks = {
    allActualNativeAppendsSucceeded: allRuns.every((run) => run.success && !run.error),
    actualInitAndResultIdentifiersMatch: allRuns.every(
      (run) => Boolean(run.actualSessionId) && run.actualSessionId === run.actualResultSessionId,
    ),
    originalThreeAppendsUseSameSession: seedRuns.every(
      (run) => run.actualSessionId === sourceSessionId,
    ),
    actualForkGetsDistinctNativeSession: fork.actualSessionId !== sourceSessionId,
    noAssistantModelTurnsOrCharges: allRuns.every(
      (run) =>
        run.turns === 0 &&
        run.costUsd === 0 &&
        run.durationApiMs === 0 &&
        run.assistantMessageCount === 0,
    ),
    boundaryComesFromActualNativeHistory:
      selectedBoundary === null ||
      sourceMessages.some(
        (message: any) => message.uuid === selectedBoundary.uuid && message.type === 'assistant',
      ),
    requestedBoundaryAndSourceMatch:
      fork.selection.kind === 'fork' &&
      fork.selection.sessionId === sourceSessionId &&
      (fork.selection.boundary ?? null) === (selectedBoundary?.uuid ?? null),
    actualForkRetainsExactSelectedPrefix:
      JSON.stringify(view(forkMessages.slice(0, sourcePrefix.length))) ===
      JSON.stringify(view(sourcePrefix)),
    actualOriginalMarkerRetentionMatches:
      JSON.stringify(actualMarkers) === JSON.stringify(expectedMarkers),
    actualFollowUpStoredInForkOnly:
      forkMessages.some((message: any) => message.uuid === fork.promptId) &&
      !originalAfter.some((message: any) => message.uuid === fork.promptId),
    originalUserContextUnchanged:
      JSON.stringify(view(originalAfter.filter((message: any) => message.type === 'user'))) ===
      JSON.stringify(view(sourceMessages.filter((message: any) => message.type === 'user'))),
    allOriginalMarkersRemainInSource: markers.every((marker) =>
      JSON.stringify(originalAfter).includes(marker),
    ),
    followUpDoesNotRestateOriginalMarkers: markers.every((marker) => !followUp.includes(marker)),
    separateHostFileIsNotRewound:
      (await readFile(path.join(workspace, 'owned-note.txt'), 'utf8')) === noteText,
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      nativeConfigDirectory,
      markers,
      seedRuns,
      sourceSessionId,
      before,
      selectedBoundary,
      sourcePrefix,
      fork,
      after,
      originalAfter,
      forkMessages,
      output: {
        sourceNativeSession: sourceSessionId,
        actualForkNativeSession: fork.actualSessionId,
        selectedBoundaryUUID: selectedBoundary?.uuid ?? null,
        originalMessageCount: sourceMessages.length,
        keptSourcePrefixMessages: sourcePrefix.length,
        actualForkMessageCount: forkMessages.length,
        expectedMarkerPresence: expectedMarkers,
        actualMarkerPresence: actualMarkers,
        sourceFullMessageHashUnchanged: digest(sourceMessages) === digest(originalAfter),
        rawForkMarkerPresence: markers.map((marker) => rawFork.includes(marker)),
        hostFileRemainsAtLatestState: checks.separateHostFileIsNotRewound,
      },
      fixtureDisclosure:
        'Fresh owned native transcript-only context. Actual resume, forkSession and resumeSessionAt options plus independent SDK history reads. Boundaries are actual stored assistant-role No response requested placeholders inserted by the pinned native runtime; no assistant model inference occurs. A separate host-created note demonstrates filesystem scope.',
      checks,
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
