import path from 'node:path';
import { spawn } from 'node:child_process';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const python = process.env.LAB_PYTHON || 'python', input = { tenant: 'alice', question: 'delivery retry' };
  const execution = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(python, [path.resolve(import.meta.dirname, '../python/main.py'), mode, JSON.stringify(input)], { windowsHide: true, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = ''; const timer = setTimeout(() => child.kill(), 180000);
    child.stdout.on('data', data => stdout += data); child.stderr.on('data', data => stderr += data); child.once('error', error => { clearTimeout(timer); reject(error); }); child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
  if (execution.code !== 0) throw new Error('Python runtime failed. Set LAB_PYTHON to a Python 3.12+ executable. ' + execution.stderr);
  const ported = JSON.parse(execution.stdout), typescript = { tenant: input.tenant, evidenceId: 'D1', retryLimit: 3 };
  const observed = await native(mode === 'live' ? 'State that delivery retry limit is three and cite D1.' : JSON.stringify(typescript), {}, mode === 'live'); requireNative(observed, mode !== 'live');
  return report({ typescript, python: ported, differences: { options: 'TypeScript camelCase; Python ClaudeAgentOptions snake_case', lifecycle: 'Both drain async iterators; interactive Python uses ClaudeSDKClient context manager', localPort: 'Python stdlib contract check, not native SDK inference', parity: 'Feature parity must be checked per installed version; do not assume sessionStore TypeScript adapter ports directly.' } }, { crossLanguageContract: JSON.stringify(typescript) === JSON.stringify(ported.contract), pythonActuallyExecuted: execution.code === 0, livePythonSuccess: mode !== 'live' || ported.liveSuccess === true }, { python: ported, observed }, 'Run Python 3.12+; install python/requirements.txt for live Python SDK. Local mode compares a real executed Python contract with TypeScript, without claiming Python model verification.');
}
