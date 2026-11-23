import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectTypeScriptEnvironment} from '../src/typescript.js';
import {runEnvironmentExperiment} from '../src/experiment.js';

test('the real TypeScript SDK spawn receives the replacement environment',async()=>{
  const result=await inspectTypeScriptEnvironment(false);
  assert.equal(result.observed.parentMarker,null);assert.equal(result.observed.customValue,'child-override');assert.equal(result.verified,true);assert.equal(result.modelPromptSent,false);
});
test('spreading the parent environment retains its classroom marker',async()=>{
  const result=await inspectTypeScriptEnvironment(true);
  assert.equal(result.observed.parentMarker,'PARENT_MARKER');assert.equal(result.observed.customValue,'child-override');assert.equal(result.initialized,true);assert.equal(result.verified,true);
});
test('rejects unsupported modes before starting an SDK runtime',async()=>{
  await assert.rejects(runEnvironmentExperiment('unknown'),/INVALID_MODE/);
});
