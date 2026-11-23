import { build } from 'esbuild';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { child } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const root = process.env.LAB_WORKSPACE!, outfile = path.join(root, 'dist', 'worker.mjs'); await mkdir(path.dirname(outfile), { recursive: true });
  await build({ entryPoints: [path.join(import.meta.dirname, 'packaged-entry.ts')], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  const result = await child([outfile, mode], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, NODE_PATH: path.resolve('node_modules') } });
  if (result.code !== 0) throw new Error(result.stderr); const observed = JSON.parse(result.stdout);
  return report({ bundledArtifact: outfile, nativeVersion: observed.version, target: process.platform + '-' + process.arch, cleanMachineExecuted: false }, { bundleExecuted: result.code === 0, nativeResultSucceeded: observed.success, localZeroInference: mode === 'live' || observed.turns === 0 }, observed, 'Actual /core bundle with external SDK/native packages executed on this installed host. Clean target installation remains a separate deployment check: copy the project, npm ci, then run this experiment on that machine.');
}
