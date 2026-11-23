import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expectedMarkers, selectedTarget} from '../src/project.js';

test('the fixture targets distinguish TypeScript and documentation scope', async () => {
  assert.equal((await selectedTarget('typescript')).ruleApplies, true);
  assert.equal((await selectedTarget('documentation')).ruleApplies, false);
  await assert.rejects(selectedTarget('../'), /INVALID_TARGET/);
});
test('expected markers follow the enabled project source and matching target', async () => {
  assert.deepEqual(await expectedMarkers(true, true), {projectMarker:'PROJECT-TEAL', ruleMarker:'TS-CORAL'});
  assert.deepEqual(await expectedMarkers(true, false), {projectMarker:'PROJECT-TEAL', ruleMarker:'UNKNOWN'});
  assert.deepEqual(await expectedMarkers(false, true), {projectMarker:'UNKNOWN', ruleMarker:'UNKNOWN'});
});
