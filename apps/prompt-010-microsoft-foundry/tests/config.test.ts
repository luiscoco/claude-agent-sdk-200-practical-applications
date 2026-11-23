import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundryConfiguration} from '../src/config.js';

test('resolves the resource and pins the actual deployment name',()=>{
  const result=foundryConfiguration('classroom-foundry','claude-sonnet-5-5',{});
  assert.equal(result.environment.CLAUDE_CODE_USE_FOUNDRY,'1');
  assert.equal(result.environment.ANTHROPIC_FOUNDRY_RESOURCE,'classroom-foundry');
  assert.equal(result.environment.AZURE_TOKEN_CREDENTIALS,'dev');
  assert.equal(result.summary.endpoint,'https://classroom-foundry.services.ai.azure.com/anthropic');
});
test('rejects a URL supplied as the resource name and a missing deployment',()=>{
  assert.throws(()=>foundryConfiguration('https://example.com','claude-sonnet-5-5'),/INVALID_RESOURCE/);
  assert.throws(()=>foundryConfiguration('classroom-foundry',''),/INVALID_DEPLOYMENT/);
});
test('preserves the caller environment while selecting the lesson credential route',()=>{
  const original={PATH:'classroom-path',ANTHROPIC_API_KEY:'classroom-placeholder',CLAUDE_CODE_USE_BEDROCK:'1'};
  const {environment}=foundryConfiguration('classroom-foundry','claude-sonnet-5-5',original);
  assert.equal(environment.PATH,'classroom-path');
  assert.equal(environment.ANTHROPIC_API_KEY,undefined);
  assert.equal(environment.CLAUDE_CODE_USE_BEDROCK,undefined);
  assert.equal(original.CLAUDE_CODE_USE_BEDROCK,'1');
});
