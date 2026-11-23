import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';

export const root = path.resolve(import.meta.dirname, '..');
export const projectNames = ['orbit', 'harbor', 'missing'] as const;

export async function selectProject(name: string) {
  if (!projectNames.includes(name as typeof projectNames[number])) throw new Error('Select Orbit, Harbor, or the missing-directory example.');
  const directory = path.join(root, 'fixtures', name);
  try {
    if (!(await stat(directory)).isDirectory()) throw new Error('Directory required.');
  } catch {
    throw new Error('PROJECT_DIRECTORY_MISSING · The selected cwd does not exist. Select an installed fixture project and retry.');
  }
  return {name, directory: await realpath(directory)};
}

export async function inspectProject(name: string) {
  const project = await selectProject(name);
  const readme = await readFile(path.join(project.directory, 'README.md'), 'utf8');
  const instructions = await readFile(path.join(project.directory, 'CLAUDE.md'), 'utf8');
  return {...project, readme, instructions};
}

export async function isProjectRead(directory: string, name: string, input: unknown) {
  if (name !== 'Read' || !input || typeof input !== 'object') return false;
  const requested = (input as Record<string, unknown>).file_path;
  if (typeof requested !== 'string') return false;
  try {
    const actual = await realpath(path.resolve(directory, requested));
    const expected = await realpath(path.join(directory, 'README.md'));
    return process.platform === 'win32' ? actual.toLowerCase() === expected.toLowerCase() : actual === expected;
  } catch { return false; }
}
