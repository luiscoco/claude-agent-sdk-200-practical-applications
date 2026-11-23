import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, realpath, access } from 'node:fs/promises';
import path from 'node:path';
import { native, requireNative, report } from './native.js';
import { toolCalls } from './conversation.js';
const exec = promisify(execFile);
export async function run(mode: string) {
  const owned = process.env.LAB_WORKSPACE!, repo = path.join(owned, 'repository'), branch = path.join(owned, 'isolated-worktree');
  await mkdir(repo, { recursive: true });
  const git = async (...args: string[]) => (await exec('git', args, { cwd: repo, windowsHide: true })).stdout.trim();
  await git('init', '-b', 'main'); await writeFile(path.join(repo, 'owned.txt'), 'ORIGINAL'); await git('add', 'owned.txt');
  await git('-c', 'user.name=Classroom Fixture', '-c', 'user.email=classroom@example.invalid', 'commit', '-m', 'Owned worktree fixture');
  await git('worktree', 'add', '--detach', branch, 'HEAD'); await writeFile(path.join(branch, 'owned.txt'), 'ISOLATED_CHANGE');
  const originalUnchanged = await readFile(path.join(repo, 'owned.txt'), 'utf8') === 'ORIGINAL';
  const relative = path.relative(await realpath(owned), await realpath(branch));
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Refusing cleanup outside the owned experiment.');
  await git('worktree', 'remove', '--force', branch);
  let removed = false; try { await access(branch); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') removed = true; else throw error; }
  const live = mode === 'live' ? await native('Use EnterWorktree to create a classroom worktree, change owned.txt there to MODEL_ISOLATED_CHANGE, then ExitWorktree with discard_changes true. Report completion.', {
    cwd: repo, tools: ['EnterWorktree', 'ExitWorktree', 'Read', 'Write'], canUseTool: async (name, input) => {
      if (['EnterWorktree', 'ExitWorktree'].includes(name)) return { behavior: 'allow', updatedInput: input };
      const file = typeof input.file_path === 'string' ? path.resolve(input.file_path) : '', rel = path.relative(repo, file);
      return file && rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: 'Only the owned repository and its worktrees are permitted.' };
    },
  }, true) : null;
  if (live) requireNative(live, false);
  return report({ repository: repo, cleanedWorktree: branch, remainingWorktrees: await git('worktree', 'list', '--porcelain') }, {
    actualGitWorktreeIsolatesChanges: originalUnchanged, actualOwnedWorktreeCleanupSucceeded: removed,
    ...(live ? { actualNativeWorktreeToolsUsed: ['EnterWorktree', 'ExitWorktree'].every(name => toolCalls(live.events, name).length > 0),
      originalStillUnchangedAfterModelWork: await readFile(path.join(repo, 'owned.txt'), 'utf8') === 'ORIGINAL' } : {}),
  }, { live }, 'Local mode creates and removes an actual owned Git worktree after verifying its resolved cleanup path. Live mode additionally requires native worktree tool calls. No user repository is used.');
}
