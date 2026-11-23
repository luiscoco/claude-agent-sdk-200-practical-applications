import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  let accepting = true; const owned = spawn(process.execPath, ['-e', 'process.stdout.write("ready\\n");setInterval(()=>{},1000)'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await once(owned.stdout!, 'data'); const closed = once(owned, 'close'); accepting = false; const killed = owned.kill(); const exit = await closed;
  const evidence = await exercise(mode, 'Assess this graceful shutdown report and distinguish cancellation from task completion.', async () => ({ accepting, cancellationRequested: killed, childExit: exit, pid: owned.pid }), 'shutdown');
  return report(evidence.local, { admissionsStopped: !accepting, ownedSubprocessClosed: owned.exitCode !== null || owned.signalCode !== null, cancellationRequested: killed }, evidence, 'Owned process cancellation and admission stop; child exit is awaited. SDK query wrappers drain or abort within their own deadline and close in finally. Production shutdown also needs process-tree isolation and server connection draining.');
}
