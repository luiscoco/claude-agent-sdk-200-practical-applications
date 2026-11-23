import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendContext } from './append.js';
import { requestSchema } from './selection.js';
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
        reject(new Error('Native history reader failed: ' + stderr));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error('Native history reader returned invalid JSON.'));
      }
    });
  });
}
export async function runSelection(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/selection-')),
    nativeConfigDirectory = path.join(workspace, 'native-config');
  const directoryA = path.join(workspace, requestedInput.mode === 'shared' ? 'shared' : 'user-a');
  const directoryB = requestedInput.mode === 'shared' ? directoryA : path.join(workspace, 'user-b');
  await mkdir(directoryA, { recursive: true });
  await mkdir(directoryB, { recursive: true });
  const markerA = 'LATEST_A_' + randomBytes(4).toString('hex').toUpperCase(),
    markerB = 'LATEST_B_' + randomBytes(4).toString('hex').toUpperCase();
  const seedA = await appendContext(
    directoryA,
    nativeConfigDirectory,
    `Owned classroom User A context: ${requestedInput.topic}; marker ${markerA}.`,
    { kind: 'new' },
  );
  const seedB = await appendContext(
    directoryB,
    nativeConfigDirectory,
    `Owned classroom User B context: ${requestedInput.topic}; marker ${markerB}.`,
    { kind: 'new' },
  );
  if (!seedA.success || !seedB.success)
    throw new Error(seedA.error || seedB.error || 'Native seed appends did not succeed.');
  const readInput = {
    nativeConfigDirectory,
    queryDirectory: directoryA,
    sessionIds: [seedA.actualSessionId, seedB.actualSessionId],
  };
  const before = await history(readInput);
  const followUp = `Owned User A follow-up about the earlier ${requestedInput.topic} classroom plan. Keep its original marker context.`;
  const implicit = await appendContext(directoryA, nativeConfigDirectory, followUp, {
    kind: 'latest',
  });
  const afterImplicit = await history(readInput);
  const explicit = await appendContext(
    directoryA,
    nativeConfigDirectory,
    followUp + ' This request explicitly selects User A.',
    { kind: 'explicit', sessionId: seedA.actualSessionId },
  );
  const afterExplicit = await history(readInput);
  const messages = (snapshot: Record<string, any>, id: string) =>
    snapshot.sessions.find((session: any) => session.sessionId === id)?.messages ?? [];
  const contains = (items: any[], text: string) => JSON.stringify(items).includes(text);
  const hasUUID = (items: any[], id: string) => items.some((item) => item.uuid === id);
  const digest = (items: any[]) => createHash('sha256').update(JSON.stringify(items)).digest('hex');
  const expectedImplicitId =
    requestedInput.mode === 'shared' ? seedB.actualSessionId : seedA.actualSessionId;
  const runs = [seedA, seedB, implicit, explicit];
  const checks = {
    actualNativeAppendsSucceeded: runs.every((run) => run.success && !run.error),
    actualInitAndResultIdentifiersMatch: runs.every(
      (run) => Boolean(run.actualSessionId) && run.actualSessionId === run.actualResultSessionId,
    ),
    twoOwnedNativeSessionsAreDistinct: seedA.actualSessionId !== seedB.actualSessionId,
    noAssistantModelTurnsOrCharges: runs.every(
      (run) =>
        run.turns === 0 &&
        run.costUsd === 0 &&
        run.durationApiMs === 0 &&
        run.assistantMessageCount === 0,
    ),
    actualLatestEligibleSessionMatchesDirectoryCase:
      before.latestEligibleSessionId === expectedImplicitId,
    actualContinueSelectsLatestEligibleSession:
      implicit.actualSessionId === before.latestEligibleSessionId,
    implicitFollowUpStoredInActualSelectedHistory: hasUUID(
      messages(afterImplicit, expectedImplicitId),
      implicit.promptId,
    ),
    sharedMismatchOrIsolatedMatchObserved:
      requestedInput.mode === 'shared'
        ? implicit.actualSessionId !== seedA.actualSessionId &&
          !hasUUID(messages(afterImplicit, seedA.actualSessionId), implicit.promptId)
        : implicit.actualSessionId === seedA.actualSessionId,
    separateOriginalContextMarkersPersisted:
      contains(messages(before, seedA.actualSessionId), markerA) &&
      !contains(messages(before, seedA.actualSessionId), markerB) &&
      contains(messages(before, seedB.actualSessionId), markerB) &&
      !contains(messages(before, seedB.actualSessionId), markerA),
    explicitResumeSelectsIntendedNativeSession:
      explicit.actualSessionId === seedA.actualSessionId &&
      hasUUID(messages(afterExplicit, seedA.actualSessionId), explicit.promptId),
    explicitRepairPreservesOtherSession:
      digest(messages(afterExplicit, seedB.actualSessionId)) ===
      digest(messages(afterImplicit, seedB.actualSessionId)),
    followUpDoesNotRestateEitherOriginalMarker:
      !followUp.includes(markerA) && !followUp.includes(markerB),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      directoryA,
      directoryB,
      nativeConfigDirectory,
      markerA,
      markerB,
      seedA,
      seedB,
      before,
      implicit,
      afterImplicit,
      explicit,
      afterExplicit,
      output: {
        intendedUserASession: seedA.actualSessionId,
        userBSession: seedB.actualSessionId,
        latestEligibleBeforeFollowUp: before.latestEligibleSessionId,
        actualImplicitSession: implicit.actualSessionId,
        implicitRoutesToUserA: implicit.actualSessionId === seedA.actualSessionId,
        actualExplicitSession: explicit.actualSessionId,
        explicitRoutesToUserA: explicit.actualSessionId === seedA.actualSessionId,
      },
      fixtureDisclosure:
        'Fresh owned two-user classroom context. Actual native transcript-only appends, continuation, explicit resume and independent history reads. No assistant inference or authentication/authorization service is demonstrated. In shared mode a verified result means the expected wrong-session selection was actually observed.',
      checks,
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
