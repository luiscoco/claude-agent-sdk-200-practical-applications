import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { child, exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const started = performance.now(), file = path.join(process.env.LAB_WORKSPACE!, 'probe.txt'); await writeFile(file, 'durable-within-worker');
  const subprocess = await child(['-e', 'process.stdout.write("first\\n"); setTimeout(()=>process.stdout.write("second\\n"),25)']);
  const probes = { filesystemRoundTrip: await readFile(file, 'utf8') === 'durable-within-worker', subprocess: subprocess.code === 0, multipleWrites: subprocess.stdout === 'first\nsecond\n', elapsedMs: performance.now() - started,
    limits: { hostingDurationLimit: 'unknown: check target platform configuration', filesystemSurvivesReplacement: 'not established', streamingThroughProxy: 'not established' } };
  const evidence = await exercise(mode, 'Assess platform suitability using observed probes. State unknown limits explicitly.', async () => probes, 'runtime');
  return report(probes, { filesystem: probes.filesystemRoundTrip, subprocess: probes.subprocess, streamWrites: probes.multipleWrites, honestLimits: probes.limits.hostingDurationLimit.startsWith('unknown') }, evidence, 'Run on the actual target host. A local probe cannot certify an edge runtime or reverse proxy.');
}
