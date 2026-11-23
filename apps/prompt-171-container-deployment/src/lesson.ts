import { access, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { exercise, child } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const root = path.resolve(import.meta.dirname, '..'), workspace = process.env.LAB_WORKSPACE!;
  await mkdir(path.join(workspace, 'writable'), { recursive: true }); await access(path.join(workspace, 'writable'));
  const dockerfile = await readFile(path.join(root, 'Dockerfile'), 'utf8');
  const probe = await child(['-e', 'console.log(JSON.stringify({subprocess:true,node:process.versions.node}))']);
  const evidence = await exercise(mode, 'Review this container readiness report. Distinguish host checks from image execution.', async () => ({ subprocess: probe.code === 0, writable: true, dockerfile, imageExecuted: false }), 'container');
  return report(evidence.local, { subprocessAvailable: probe.code === 0, runtimeAndUserDeclared: dockerfile.includes('node:24') && dockerfile.includes('USER node'), writableRuntimeConfigured: dockerfile.includes('/app/runs'), modelToolObserved: mode !== 'live' || evidence.calls.length > 0 }, evidence,
    'Host readiness and Dockerfile contract only. Build and run the image using README commands to verify the target container. Docker daemon/image execution is a separate required deployment check.');
}
