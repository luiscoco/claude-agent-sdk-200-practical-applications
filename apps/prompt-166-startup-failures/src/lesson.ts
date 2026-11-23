import { native, requireNative, report } from './native.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
export async function run(mode: string) {
  const missing = await native('Owned missing binary probe.', { pathToClaudeCodeExecutable: path.join(process.env.LAB_WORKSPACE!, 'missing-native-executable') });
  const exited = await native('Owned unexpected process exit probe.', { spawnClaudeCodeProcess: () => spawn(process.execPath, ['-e', 'process.exit(17)'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }) });
  const healthy = await native(mode === 'live' ? 'Reply STARTUP_RECOVERED.' : 'Owned healthy startup control.', {}, mode === 'live');
  requireNative(healthy, mode !== 'live');
  return report({ missingBinaryFailure: missing.error, unexpectedExitFailure: exited.error,
    authScope: 'No fake authentication failure is sent to a provider. Real credential failures are preserved by the live verifier when they occur.' }, {
    missingBinaryActuallyFails: !missing.success && Boolean(missing.error),
    unexpectedExitActuallyFails: !exited.success && Boolean(exited.error), actualHealthyStartupRecovers: healthy.success,
  }, { missing, exited, healthy }, 'Controlled failures use a nonexistent owned executable path and an owned child exiting with code 17. Recovery uses a real native SDK process; diagnostics do not treat every startup error as an authentication error.');
}
