import { spawn } from 'node:child_process';
import path from 'node:path';
export async function runApplicationWorker(
  operation: 'seed' | 'resume' | 'fresh',
  argument: string,
) {
  const root = path.resolve(import.meta.dirname, '..');
  const spawnedAt = new Date().toISOString();
  return new Promise<{
    pid: number | undefined;
    spawnedAt: string;
    exitedAt: string;
    exitCode: number | null;
    signal: string | null;
    stderr: string;
    result: Record<string, any>;
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'src/worker.ts', operation, argument],
      { cwd: root, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '',
      stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (text) => {
      stdout += text;
    });
    child.stderr.on('data', (text) => {
      stderr += text;
    });
    child.once('error', reject);
    child.once('close', (exitCode, signal) => {
      try {
        const result = JSON.parse(stdout.trim());
        resolve({
          pid: child.pid,
          spawnedAt,
          exitedAt: new Date().toISOString(),
          exitCode,
          signal,
          stderr,
          result,
        });
      } catch {
        reject(new Error('Application worker did not return its actual JSON result. ' + stderr));
      }
    });
  });
}
