import path from 'node:path';
import { mkdir, readFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DeferredRun } from './agent.js';

export const root = path.resolve(import.meta.dirname, '..');
export function runDirectory(id: string) {
  return path.join(root, 'runs', z.string().uuid().parse(id));
}
export async function loadRun(id: string): Promise<DeferredRun> {
  const data = JSON.parse(await readFile(path.join(runDirectory(id), 'state.json'), 'utf8'));
  if (data.id !== id || data.workspace !== path.join(runDirectory(id), 'workspace'))
    throw new Error('Unexpected deferred classroom workspace.');
  return data;
}
export async function saveRun(state: DeferredRun) {
  const directory = runDirectory(state.id);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, 'state-' + randomUUID() + '.tmp');
  await writeFile(temporary, JSON.stringify(state, null, 2));
  await rename(temporary, path.join(directory, 'state.json'));
}
export async function withRunLock<T>(id: string, action: () => Promise<T>) {
  const directory = runDirectory(id);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'worker.lock');
  let handle;
  try {
    handle = await open(file, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const owner = JSON.parse(await readFile(file, 'utf8'));
    try {
      process.kill(owner.pid, 0);
      throw new Error('This classroom run already has an active worker.');
    } catch (failure) {
      if ((failure as NodeJS.ErrnoException).code !== 'ESRCH') throw failure;
    }
    await unlink(file);
    handle = await open(file, 'wx');
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid }));
    return await action();
  } finally {
    await handle.close();
    await unlink(file);
  }
}
