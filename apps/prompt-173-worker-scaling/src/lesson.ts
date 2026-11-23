import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { child } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const root = process.env.LAB_WORKSPACE!, storeDirectory = path.join(root, 'durable-store');
  async function worker(id: string, sessionId?: string) {
    const workspace = path.join(root, id); await mkdir(workspace, { recursive: true });
    const result = await child(['--import', 'tsx', path.join(import.meta.dirname, 'remote-worker.ts'), JSON.stringify({ storeDirectory, sessionId, text: sessionId ? 'Recall the routing marker ALPHA-173 from the restored transcript.' : 'Remember routing marker ALPHA-173.', live: mode === 'live' })],
      { env: { ...process.env, LAB_WORKSPACE: workspace, CLAUDE_CONFIG_DIR: path.join(workspace, 'config'), CLAUDE_CODE_PROJECT_KEY: 'owned-routing-173' } });
    if (result.code !== 0) throw new Error(result.stderr); return JSON.parse(result.stdout);
  }
  const first = await worker('worker-a'), second = await worker('worker-b', first.result.sessionId);
  const answer = second.result.events.findLast((e: any) => e.type === 'result')?.result || '';
  return report({ firstPid: first.pid, replacementPid: second.pid, session: second.result.sessionId }, { replacedProcess: first.pid !== second.pid, restoredSameSession: first.result.sessionId === second.result.sessionId, privateWorkerConfiguration: first.config !== second.config, recalledMarker: mode !== 'live' || answer.includes('ALPHA-173') }, { first, second }, 'Sequential replacement workers sharing an atomic file session store. Workspace files must be provisioned separately. Same-session concurrent writers need distributed locking.');
}
