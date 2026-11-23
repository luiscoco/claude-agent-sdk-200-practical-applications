import path from 'node:path';
import { spawn } from 'node:child_process';
import { FileSessionStore } from './store.js';
import { native, report } from './native.js';
import { randomUUID } from 'node:crypto';
import { recall } from './live.js';
export async function run(mode: string) {
  const conformance = await new Promise<{ passed: boolean; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--test', 'tests/conformance.test.ts'], {
      cwd: path.resolve(import.meta.dirname, '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', chunk => output += chunk);
    child.once('error', reject); child.once('close', code => resolve({ passed: code === 0, output }));
  });
  const store = new FileSessionStore(path.join(process.env.LAB_RUN!, 'store'));
  const noPersist = await native('This incompatible combination must be rejected.', { sessionStore: store, persistSession: false });
  const checkpoint = await native('This incompatible combination must be rejected.', { sessionStore: store, enableFileCheckpointing: true });
  const marker = 'CONFORMANCE_' + randomUUID();
  const liveSeed = mode === 'live' ? await native(`Owned classroom marker ${marker}. Reply with OK.`, { sessionStore: store }, true) : null;
  const remembered = liveSeed?.success ? await recall(liveSeed.sessionId, marker, { sessionStore: store }) : null;
  return report({ conformance, rejectedConfigurations: [noPersist.error, checkpoint.error] }, {
    officialAdapterContractCasesPassed: conformance.passed,
    persistFalseRejectedByActualSdk: !noPersist.success && /persistSession/i.test(noPersist.error || ''),
    checkpointingRejectedByActualSdk: !checkpoint.success && /checkpoint/i.test(checkpoint.error || ''),
    ...(mode === 'live' ? { liveModelStoreResumeVerified: Boolean(remembered?.remembered) } : {}),
  }, { noPersist, checkpoint, liveSeed, remembered }, 'Anthropic’s official 13 conformance cases are vendored intact; only the Bun test import is replaced with Node test/assert bridging. Additional checks use the installed SDK to reject unsupported option combinations. Live mode also verifies actual model recall after store resumption.');
}
