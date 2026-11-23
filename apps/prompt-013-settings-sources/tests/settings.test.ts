import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectSettings,sourcesFor} from '../src/settings.js';

test('the real SDK resolves user, project and local precedence',async()=>{
  for(const [mode,value,source]of [['user',7,'user'],['project',14,'project'],['local',21,'local'],['team',14,'project'],['all',21,'local']]as const){
    const result=await inspectSettings(mode);
    assert.equal(result.cleanupPeriodDays,value);assert.equal(result.provenance?.source,source);assert.equal(result.origin,source);
  }
});
test('omitting the option loads all three fixture sources',async()=>{
  const result=await inspectSettings('default');
  assert.equal(result.optionOmitted,true);assert.equal(result.cleanupPeriodDays,21);
  assert.deepEqual(result.sources.filter(row=>['user','project','local'].includes(row.source)).map(row=>row.source),['user','project','local']);
});
test('an empty selection disables optional filesystem sources',async()=>{
  const result=await inspectSettings('off');
  assert.deepEqual(result.selection,[]);assert.equal(result.cleanupPeriodDays,null);assert.equal(result.origin,null);
  assert.equal(result.sources.some(row=>['user','project','local'].includes(row.source)),false);
  assert.throws(()=>sourcesFor('unknown'),/INVALID_SOURCE_SELECTION/);
});
