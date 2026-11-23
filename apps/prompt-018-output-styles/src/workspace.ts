import path from 'node:path';
import {cp, mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

export const root = path.resolve(import.meta.dirname, '..');
export const testCommand = 'node --test --test-reporter=tap tests/calculator.test.mjs';
const execute = promisify(execFile);

export function validateStyle(style: string) {
  if (!['teaching-report', 'default'].includes(style)) {
    throw new Error('INVALID_STYLE · Select teaching-report or default.');
  }
  return style;
}

export async function createWorkspace() {
  const id = randomUUID();
  const directory = path.join(root, 'runs', id);
  const workspace = path.join(directory, 'workspace');
  await mkdir(directory, {recursive:true});
  await cp(path.join(root, 'fixtures/template'), workspace, {recursive:true});
  return {id, directory, workspace};
}

export function testCounts(output: string) {
  return {
    total:Number(output.match(/# tests\s+(\d+)/)?.[1] || 0),
    passed:Number(output.match(/# pass\s+(\d+)/)?.[1] || 0),
    failed:Number(output.match(/# fail\s+(\d+)/)?.[1] || 0)
  };
}

export async function runTests(workspace: string) {
  const environment = {...process.env};
  // Each verification launches its own test runner, including when called by a test.
  delete environment.NODE_TEST_CONTEXT;
  try {
    const result = await execute(process.execPath, ['--test', '--test-reporter=tap', 'tests/calculator.test.mjs'], {
      cwd:workspace, env:environment, windowsHide:true, timeout:30000, maxBuffer:131072
    });
    return {exitCode:0, stdout:result.stdout, stderr:result.stderr, counts:testCounts(result.stdout)};
  } catch (error) {
    const failure = error as Error & {code?:number|string; stdout?:string; stderr?:string};
    const stdout = failure.stdout || '';
    return {exitCode:typeof failure.code === 'number' ? failure.code : -1, stdout, stderr:failure.stderr || failure.message, counts:testCounts(stdout)};
  }
}
