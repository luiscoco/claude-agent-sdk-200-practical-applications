import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {directoryConfiguration} from '../src/directories.js';

test('additional directory grant is explicit and excludes the unrelated sibling',async()=>{
  const denied=await directoryConfiguration(false,true);
  const granted=await directoryConfiguration(true,true);
  assert.deepEqual(denied.additionalDirectories,[]);
  assert.equal(granted.additionalDirectories.length,1);
  assert.equal(path.basename(granted.additionalDirectories[0]),'shared');
  assert.ok(path.isAbsolute(granted.cwd));
  assert.ok(granted.fixtures.every(file=>file.exists));
});
test('configuration discovery is controlled separately',async()=>{
  const configuration=await directoryConfiguration(true,false);
  assert.equal(configuration.additionalDirectories.length,1);
  assert.deepEqual(configuration.settingSources,[]);
  await assert.rejects(directoryConfiguration('true' as unknown as boolean,true),/explicitly/);
});
