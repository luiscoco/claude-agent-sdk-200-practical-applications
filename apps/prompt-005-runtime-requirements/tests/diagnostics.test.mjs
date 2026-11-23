import test from 'node:test';
import assert from 'node:assert/strict';
import { meetsMinimum, diagnoseRuntime } from '../src/diagnostics.mjs';

test('minimum requirements compare every version component',()=>{
  assert.equal(meetsMinimum('24.14.1','>=18.14.0'),true);
  assert.equal(meetsMinimum('18.13.9','>=18.14.0'),false);
  assert.equal(meetsMinimum('3.12.15','>=3.10'),true);
  assert.equal(meetsMinimum('18.14.0','>=18.14.0'),true);
  assert.equal(meetsMinimum('24.14.1','^18.0.0'),null);
});
test('installed native runtime and a genuinely absent path produce distinct diagnoses',async()=>{
  const valid=await diagnoseRuntime();assert.equal(valid.status,'passed');assert.match(valid.runtimeOutput,/Claude Code/);
  assert.equal(valid.environment.language,'Node.js');
  const missing=await diagnoseRuntime({missingBinary:true});assert.equal(missing.status,'attention');
  assert.equal(missing.runtimeOutput,null);assert.ok(missing.checks.some(check=>check.status==='failed'&&check.remedy));
});
test('invalid diagnostic inputs are rejected',async()=>{
  await assert.rejects(diagnoseRuntime({language:'arbitrary'}),/Choose TypeScript or Python/);
  await assert.rejects(diagnoseRuntime({missingBinary:'yes'}),/boolean/);
});
