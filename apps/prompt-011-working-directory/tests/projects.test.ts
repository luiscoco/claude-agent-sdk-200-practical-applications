import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { inspectProject, isProjectRead, selectProject } from '../src/projects.js';

test('selects distinct absolute cwd fixtures and their project files',async()=>{
  const orbit=await inspectProject('orbit');
  const harbor=await inspectProject('harbor');
  assert.ok(path.isAbsolute(orbit.directory));
  assert.notEqual(orbit.directory,harbor.directory);
  assert.match(orbit.readme,/Project: Orbit/);
  assert.match(harbor.instructions,/HARBOR-CORAL/);
});
test('reports a missing cwd and rejects arbitrary project names',async()=>{
  await assert.rejects(selectProject('missing'),/PROJECT_DIRECTORY_MISSING/);
  await assert.rejects(selectProject('../../'),/Select Orbit/);
});
test('classroom Read policy permits the selected README and checks canonical paths',async()=>{
  const orbit=await selectProject('orbit');
  assert.equal(await isProjectRead(orbit.directory,'Read',{file_path:'README.md'}),true);
  assert.equal(await isProjectRead(orbit.directory,'Read',{file_path:'../harbor/README.md'}),false);
  assert.equal(await isProjectRead(orbit.directory,'Read',{file_path:'CLAUDE.md'}),false);
  assert.equal(await isProjectRead(orbit.directory,'Bash',{command:'pwd'}),false);
});
