import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RunService } from '../src/service.js';
async function fixture(fn:(root:string)=>Promise<void>){const root=await mkdtemp(path.join(os.tmpdir(),'agent-lesson-test-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
test('local mode writes real artifacts and explicitly records no AI activity',()=>fixture(async root=>{
  const service=new RunService(root,async()=>{throw Error('Must not call agent');});
  const run=service.start('verify','12\n8\n15\n5\n10');await run.finished;
  assert.equal(run.status,'completed');assert.equal(run.report?.actual.total,50);assert.equal(run.report?.agent,undefined);
  const report=JSON.parse(await readFile(path.join(root,run.id,'report.json'),'utf8'));
  assert.equal(report.mode,'verify');assert.equal(report.sourceSha256.length,64);
}));
test('preflight failure spends no model call and creates no success report',()=>fixture(async root=>{
  let calls=0;const service=new RunService(root,async()=>{calls++;throw Error('Must not call');});
  const run=service.start('agent','12\n8\nfifteen');await run.finished;
  assert.equal(calls,0);assert.equal(run.status,'failed');assert.equal(run.error?.line,3);
  await assert.rejects(access(path.join(root,run.id,'report.json')));
}));
test('injected incorrect model result is rejected rather than published',()=>fixture(async root=>{
  const service=new RunService(root,async()=>({statistics:{count:2,total:999,min:1,max:2},readCalls:1}));
  const run=service.start('agent','1\n2');await run.finished;
  assert.equal(run.error?.code,'RESULT_MISMATCH');assert.equal(run.report,undefined);
  await assert.rejects(access(path.join(root,run.id,'report.json')));
}));
test('injected correct model result yields matching independent evidence',()=>fixture(async root=>{
  const service=new RunService(root,async()=>({statistics:{count:2,total:3,min:1,max:2},readCalls:1,model:'test-double'}));
  const run=service.start('agent','1\n2');await run.finished;
  assert.equal(run.status,'completed');assert.deepEqual(run.report?.actual,run.report?.expected);
}));
