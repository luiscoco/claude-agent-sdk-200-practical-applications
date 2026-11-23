import path from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
import { native, requireNative, report } from './native.js';
import { child } from './exercise.js';
export async function run(mode: string) {
  const cwd = process.env.LAB_WORKSPACE!, source = path.join(cwd, 'add.mjs'), test = path.join(cwd, 'add.test.mjs');
  await writeFile(source, 'export const add=(a,b)=>a-b;\n'); await writeFile(test, "import assert from 'node:assert/strict';import {add} from './add.mjs';assert.equal(add(2,3),5);assert.equal(add(-2,3),1);\n");
  const before = await child([test]); let observed: any;
  if (mode === 'live') { observed = await native(`Diagnose failing test ${test}. You may read these two files and edit ONLY ${source}. Correct addition. The host will independently run the test. Do not change the test.`, { cwd, tools: ['Read', 'Edit'], canUseTool: async (name, input) => typeof input.file_path === 'string' && (name === 'Read' && [source, test].includes(path.resolve(input.file_path)) || name === 'Edit' && path.resolve(input.file_path) === source) ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Only the approved source may be edited.' } }, true); requireNative(observed, false); }
  else { await writeFile(source, 'export const add=(a,b)=>a+b;\n'); observed = await native('Record the explicitly approved deterministic classroom patch; no model repair claimed.'); requireNative(observed); }
  const after = await child([test]);
  return report({ baselineExit: before.code, patchedExit: after.code, approvedFile: 'add.mjs', patch: await readFile(source, 'utf8') }, { baselineReallyFails: before.code !== 0, independentVerificationPasses: after.code === 0, testRemainsIntact: (await readFile(test, 'utf8')).includes('add(-2,3),1') }, { before, after, observed }, 'Owned failing test and approved edit boundary. Local patch is deterministic and labelled. Live mode requires an actual model edit followed by a separate host test process.');
}
