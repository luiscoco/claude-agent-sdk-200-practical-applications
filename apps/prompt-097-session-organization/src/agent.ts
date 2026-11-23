import path from 'node:path';
import { mkdir, mkdtemp, cp, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { requestSchema } from './organization.js';

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
    child.once('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error('Native organization worker failed: ' + stderr));
        return;
      }
      try {
        resolve({
          actualProcessId: child.pid,
          exitCode,
          exitedAt: new Date().toISOString(),
          ...JSON.parse(stdout.trim()),
        });
      } catch {
        reject(new Error('Native organization worker returned invalid JSON.'));
      }
    });
  });
}
export async function runOrganization(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  const fixtureRoot = path.join(root, 'fixtures');
  const catalog = JSON.parse(
    (await readFile(path.join(fixtureRoot, 'catalog.json'), 'utf8')).replace(/^\uFEFF/, ''),
  );
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/organization-'));
  await cp(path.join(fixtureRoot, 'native-config'), path.join(workspace, 'native-config'), {
    recursive: true,
  });
  const original = catalog.sessions[0],
    other = catalog.sessions[1];
  const hashFile = async (file: string) =>
    createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  const mutation = await worker('apply', workspace, requestedInput);
  // The mutation process has exited; a fresh SDK process independently rereads persisted metadata.
  const reloaded = await worker('reload', workspace, requestedInput);
  const changedFile = path.join(workspace, original.file);
  const rows = (await readFile(changedFile, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const expectedTag = requestedInput.mode === 'clear' ? null : requestedInput.tag;
  const checks = {
    actualNativeMutationProcessSucceeded:
      mutation.exitCode === 0 && mutation.pid === mutation.actualProcessId,
    independentNativeReloadProcessSucceeded:
      reloaded.exitCode === 0 && reloaded.pid === reloaded.actualProcessId,
    titlePersistedAfterProcessExit: reloaded.after?.customTitle === requestedInput.title,
    tagPersistedOrClearedAfterProcessExit: (reloaded.after?.tag ?? null) === expectedTag,
    nativeSessionIdentityUnchanged:
      mutation.sessionId === original.sessionId && reloaded.after?.sessionId === original.sessionId,
    conversationMessagesUnchanged:
      mutation.conversationUnchanged && reloaded.afterMessageHash === mutation.beforeMessageHash,
    expectedActualUtilityCallsCompleted:
      mutation.operations.length ===
      (requestedInput.mode === 'replace' ? 4 : requestedInput.mode === 'clear' ? 3 : 2),
    originalFixtureUnchanged:
      (await hashFile(path.join(fixtureRoot, original.file))) === original.sha256,
    otherCopiedSessionUnchanged:
      (await hashFile(path.join(workspace, other.file))) === other.sha256,
    nativeMetadataWritesActuallyPersisted: (await hashFile(changedFile)) !== original.sha256,
  };
  return {
    requestedInput,
    workspace,
    mutation,
    reloaded,
    output: {
      originalMetadata: mutation.before,
      changedMetadata: mutation.after,
      reloadedMetadata: reloaded.after,
      expectedTag,
      nativeSessionId: original.sessionId,
    },
    persistedMetadataRows: rows.filter((row) => row.type === 'custom-title' || row.type === 'tag'),
    fixtureDisclosure:
      'Actual supported rename/tag utilities mutate a fresh disposable copy of a historical owned Prompt 89 classroom transcript. The original fixture and other copied session remain unchanged. No new model query is made.',
    noModelQueriesMade: true,
    checks,
    verified: Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
  };
}
