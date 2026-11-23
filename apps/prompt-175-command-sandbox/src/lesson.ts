import { native, report } from './native.js';
export async function run(mode: string) {
  const observed = await native('Report sandbox readiness without running shell commands.', { sandbox: { enabled: true, failIfUnavailable: true } }, mode === 'live');
  const unavailable = /sandbox|unsupported|not supported|bwrap|bubblewrap|socat/i.test((observed.error || '') + observed.stderr + JSON.stringify(observed.events));
  const failedClosed = !observed.success && unavailable;
  return report({ platform: process.platform, nativeSucceeded: observed.success, failedClosed, sandboxRequested: true, required: true, commandIsolationVerified: false }, { startupOutcomeExplicit: observed.success || failedClosed, unsupportedWindowsFailsClosed: process.platform !== 'win32' || failedClosed, liveRequiresSupportedRuntime: mode !== 'live' || observed.success }, observed, 'An unavailable sandbox must fail closed. Startup success alone does not verify command containment. Run an owned command containment probe on a supported Linux/macOS host before deployment.');
}
