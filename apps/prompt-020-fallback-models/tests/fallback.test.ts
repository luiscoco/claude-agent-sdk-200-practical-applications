import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backupModel,configuration,modelOptions,primaryModel} from '../src/config.js';
import {readFallbackNotice} from '../src/events.js';

test('fallback configuration preserves order and rejects the primary as its own backup', () => {
  assert.deepEqual(configuration('fallback'),{model:primaryModel,fallbackModel:backupModel});
  assert.equal(configuration('chain').fallbackModel,'claude-course-missing-backup,'+backupModel);
  assert.equal(Object.hasOwn(configuration('disabled'),'fallbackModel'),false);
  assert.throws(() => modelOptions(backupModel,[backupModel]),/INVALID_FALLBACK/);
  assert.throws(() => configuration('invalid'),/INVALID_FALLBACK/);
});
test('native fallback events require their observed wire fields', () => {
  const event = {type:'system',subtype:'model_fallback',trigger:'model_not_found',original_model:primaryModel,fallback_model:backupModel,content:'Observed switch'};
  assert.deepEqual(readFallbackNotice(event),event);
  assert.equal(readFallbackNotice({...event,trigger:null}),null);
  assert.equal(readFallbackNotice({type:'system',subtype:'init'}),null);
});
