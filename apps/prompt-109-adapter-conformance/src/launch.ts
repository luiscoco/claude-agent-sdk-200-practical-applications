import { spawn } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
export async function launch(mode: string) {
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const runDirectory = await mkdtemp(path.join(root, 'runs/experiment-'));
  return new Promise<any>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/worker.ts', mode], {
      cwd: root, windowsHide: true, env: { ...process.env,
        CLAUDE_CONFIG_DIR: path.join(runDirectory, 'native-config'),
        LAB_WORKSPACE: path.join(runDirectory, 'workspace'), LAB_RUN: runDirectory,
        CLAUDE_CODE_PROJECT_DIR_NAME: 'owned-classroom-experiment',
        CLAUDE_CODE_SKIP_PROMPT_HISTORY: '',
      }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Experiment exceeded five minutes.')); }, 300000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code !== 0) { reject(new Error(stderr.slice(-8000) || 'Experiment failed.')); return; }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Worker returned invalid JSON.')); }
    });
  });
}
