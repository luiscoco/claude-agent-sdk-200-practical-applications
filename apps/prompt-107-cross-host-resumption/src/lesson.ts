import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
import { FileSessionStore } from './store.js';
import { report } from './native.js';
async function worker(name: string, input: object) {
  const base = path.join(process.env.LAB_RUN!, name);
  const workspace = path.join(base, 'workspace'), config = path.join(base, 'native-config');
  await mkdir(workspace, { recursive: true });
  await mkdir(config, { recursive: true });
  const before = await readdir(config);
  const result = await new Promise<any>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/remote-worker.ts', JSON.stringify(input)], {
      cwd: path.resolve(import.meta.dirname, '..'), windowsHide: true,
      env: { ...process.env, LAB_WORKSPACE: workspace, CLAUDE_CONFIG_DIR: config },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    child.once('error', reject);
    child.once('close', code => {
      if (code !== 0) { reject(new Error(stderr)); return; }
      try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); }
    });
  });
  return { ...result, nativeConfigurationInitiallyEmpty: before.length === 0 };
}
export async function run(mode: string) {
  const base = process.env.LAB_RUN!, storeDirectory = path.join(base, 'shared-store');
  const marker = 'REMOTE_' + randomUUID();
  const sourceFile = path.join(base, 'worker-a/workspace/requirements.txt');
  await mkdir(path.dirname(sourceFile), { recursive: true });
  await writeFile(sourceFile, 'Owned workspace requirement: queue retries must be idempotent.');
  const a = await worker('worker-a', { storeDirectory, live: mode === 'live', text: `Owned classroom marker ${marker}. Read requirements.txt and remember the marker. Acknowledge in one sentence.` });
  const sessionId = a.result.sessionId;
  const target = path.join(base, 'worker-b/workspace/requirements.txt');
  await mkdir(path.dirname(target), { recursive: true });
  // Workspace deployment is explicit and separate from transcript resumption.
  await copyFile(sourceFile, target);
  const b = await worker('worker-b', { storeDirectory, sessionId, live: mode === 'live', text: mode === 'live'
    ? 'Return the exact owned classroom marker from the earlier conversation, with no other text.'
    : 'Follow-up from a new worker; keep the earlier conversation context.' });
  const store = new FileSessionStore(storeDirectory);
  const history = await getSessionMessages(sessionId, { sessionStore: store });
  const digest = async (file: string) => createHash('sha256').update(await readFile(file)).digest('hex');
  return report({ sessionId, history, workerA: a.pid, workerB: b.pid,
    sourceWorkspace: a.workspace, destinationWorkspace: b.workspace,
    workspaceDigest: await digest(target) }, {
    separateWorkerProcesses: a.pid !== b.pid,
    separateNativeConfiguration: a.config !== b.config && b.nativeConfigurationInitiallyEmpty,
    separateWorkspaceDirectories: a.workspace !== b.workspace,
    exactNativeSessionResumed: b.result.sessionId === sessionId,
    originalContextAndNewPromptPersisted: JSON.stringify(history).includes(marker) && history.some(m => m.uuid === b.result.promptId),
    workspaceProvisionedSeparately: await digest(sourceFile) === await digest(target),
    ...(mode === 'live' ? { liveModelRecallsMarkerOnNewWorker:
      b.result.events.findLast((e: any) => e.type === 'result')?.result?.trim() === marker,
      liveModelActuallyReadsProvisionedWorkspace: a.result.events.some((e: any) => e.type === 'assistant' &&
        e.message?.content?.some((block: any) => block.type === 'tool_use' && block.name === 'Read')),
    } : {}),
  }, { a, b }, 'Two separate local worker processes emulate hosts with distinct configuration and workspace directories, using one stable project key and shared durable storage. Transcript-only resumption is verified; model recall and an actual remote machine are not claimed. Workspace files are copied explicitly.');
}
