import path from 'node:path';
import { mkdir, mkdtemp, cp, readFile, writeFile, utimes } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { requestSchema } from './retention.js';
const root = path.resolve(import.meta.dirname, '..');
async function worker(operation: 'apply' | 'reload', directory: string, input: unknown) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'src/worker.ts', operation, directory, JSON.stringify(input)],
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
        reject(new Error('Native retention worker failed: ' + stderr));
        return;
      }
      try {
        resolve({
          actualProcessId: child.pid,
          exitCode: code,
          exitedAt: new Date().toISOString(),
          ...JSON.parse(stdout.trim()),
        });
      } catch {
        reject(new Error('Native retention worker returned invalid JSON.'));
      }
    });
  });
}
export async function runRetention(value: unknown) {
  const requestedInput = requestSchema.parse(value),
    fixtureRoot = path.join(root, 'fixtures');
  const catalog = JSON.parse(
    (await readFile(path.join(fixtureRoot, 'catalog.json'), 'utf8')).replace(/^\uFEFF/, ''),
  );
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/retention-'));
  await cp(path.join(fixtureRoot, 'native-config'), path.join(workspace, 'native-config'), {
    recursive: true,
  });
  const target = catalog.sessions[0],
    other = catalog.sessions[1],
    targetFile = path.join(workspace, target.file);
  // Owned classroom controls: actual copied-file timestamps represent a 48-hour-old and a recent session.
  const now = Date.now(),
    oldTime = new Date(now - 48 * 3600000),
    recentTime = new Date(now - 3600000);
  await utimes(targetFile, oldTime, oldTime);
  await utimes(path.join(workspace, other.file), recentTime, recentTime);
  const sessionDirectory = path.join(path.dirname(targetFile), target.sessionId, 'subagents');
  await mkdir(sessionDirectory, { recursive: true });
  await writeFile(
    path.join(sessionDirectory, 'owned-control.txt'),
    'Owned host-created deletion control artifact. This is not a native subagent transcript.',
  );
  await mkdir(path.join(workspace, 'workspace'), { recursive: true });
  const noteText =
    'Owned application workspace note. Session transcript deletion does not remove this separate file.';
  await writeFile(path.join(workspace, 'workspace/owned-note.txt'), noteText);
  const reference = {
    sdkSessionId: target.sessionId,
    classroomLabel: 'Separate application reference retained for the scope demonstration',
  };
  await writeFile(path.join(workspace, 'application-reference.json'), JSON.stringify(reference));
  const mutation = await worker('apply', workspace, requestedInput);
  const reloaded = await worker('reload', workspace, requestedInput);
  const shouldDelete =
    requestedInput.mode === 'delete-expired' && requestedInput.retentionHours === 24;
  const hashFile = async (file: string) =>
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  const targetPlan = mutation.plan.find((item: any) => item.sessionId === target.sessionId);
  const checks = {
    actualNativeWorkersSucceeded:
      mutation.exitCode === 0 &&
      reloaded.exitCode === 0 &&
      mutation.pid === mutation.actualProcessId &&
      reloaded.pid === reloaded.actualProcessId,
    twoNativeSessionsInitiallyListed: mutation.before.length === 2,
    policyRecognizesOwnedAgeAndProtection:
      targetPlan?.reason ===
      (requestedInput.mode === 'protect'
        ? 'protected'
        : requestedInput.retentionHours === 24
          ? 'expired'
          : 'recent'),
    actualNativeDeletionMatchesSelectedPolicy:
      mutation.deleted.length === (shouldDelete ? 1 : 0) &&
      (!shouldDelete || mutation.deleted[0] === target.sessionId),
    nativeUtilitiesReportedNoDeletionErrors: mutation.errors.length === 0,
    independentNativeListingMatches: reloaded.after.length === (shouldDelete ? 1 : 2),
    targetTranscriptPresenceMatches: reloaded.artifacts.targetTranscript === !shouldDelete,
    sessionSubdirectoryPresenceMatches: reloaded.artifacts.sessionSubdirectory === !shouldDelete,
    nativeMetadataAndMessagesMatch: shouldDelete
      ? reloaded.targetMetadata === null && reloaded.targetMessageCount === 0
      : reloaded.targetMetadata?.sessionId === target.sessionId && reloaded.targetMessageCount > 0,
    repeatDeleteNotFoundObservedWhenApplicable:
      !shouldDelete || (mutation.repeatDeletion.attempted && mutation.repeatDeletion.rejected),
    separateApplicationReferenceRemains:
      reloaded.artifacts.applicationReference &&
      JSON.parse(await readFile(path.join(workspace, 'application-reference.json'), 'utf8'))
        .sdkSessionId === target.sessionId,
    separateWorkspaceNoteRemains:
      reloaded.artifacts.workspaceNote &&
      (await readFile(path.join(workspace, 'workspace/owned-note.txt'), 'utf8')) === noteText,
    unrelatedCopiedSessionUnchanged:
      (await hashFile(path.join(workspace, other.file))) === other.sha256,
    originalFixturesUnchanged: (
      await Promise.all(
        catalog.sessions.map(
          async (item: any) => (await hashFile(path.join(fixtureRoot, item.file))) === item.sha256,
        ),
      )
    ).every(Boolean),
  };
  return {
    requestedInput,
    workspace,
    mutation,
    reloaded,
    output: {
      policyCutoff: new Date(mutation.cutoff).toISOString(),
      shouldDelete,
      deletedCount: mutation.deleted.length,
      remainingSessions: reloaded.after.length,
      artifacts: reloaded.artifacts,
    },
    fixtureDisclosure:
      'Actual native session deletion operates only on fresh disposable copies of owned historical classroom transcripts. Copied file mtimes intentionally represent age controls. A host-created subdirectory artifact, separate application reference and workspace note are labelled controls, not native model output. No remote deletion or model query is performed.',
    noModelQueriesMade: true,
    checks,
    verified: Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
  };
}
