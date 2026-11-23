import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveConfiguration, requireCredentials, AuthConfigurationError } from '../src/auth.js';

test('public configuration exposes presence and origin without a credential value', () => {
  const configuration = resolveConfiguration('environment',{ANTHROPIC_API_KEY:'classroom-test-value',PATH:'classroom-path'});
  requireCredentials(configuration);
  assert.equal(configuration.summary.credentialOrigin,'Process environment');
  assert.equal(configuration.summary.keyPresent,true);
  assert.ok(!JSON.stringify(configuration.summary).includes('classroom-test-value'));
  assert.equal(configuration.environment.PATH,'classroom-path');
});
test('explicit dotenv loading preserves the supplied environment and loads file defaults', () => {
  const base = {ANTHROPIC_API_KEY:'classroom-test-value',PATH:'classroom-path'};
  const configuration = resolveConfiguration('dotenv',base,path.resolve('fixtures/defaults.env'));
  assert.equal(configuration.environment.CLAUDE_MODEL,'claude-sonnet-4-6');
  assert.equal(configuration.environment.PATH,'classroom-path');
  assert.equal(configuration.summary.dotenvLoaded,true);
  assert.equal(configuration.summary.credentialOrigin,'Process environment');
  assert.deepEqual(base,{ANTHROPIC_API_KEY:'classroom-test-value',PATH:'classroom-path'});
});
test('blank configuration produces the explicit missing-credential error', () => {
  const configuration = resolveConfiguration('blank',{ANTHROPIC_API_KEY:'classroom-test-value'});
  assert.equal(configuration.summary.keyPresent,false);
  assert.throws(()=>requireCredentials(configuration), error=>error instanceof AuthConfigurationError && error.code==='MISSING_CREDENTIALS');
});
test('an empty process value can be supplied by the project dotenv file', () => {
  const configuration = resolveConfiguration('dotenv',{ANTHROPIC_API_KEY:'  '},path.resolve('fixtures/credential-test.env'));
  requireCredentials(configuration);
  assert.equal(configuration.summary.credentialOrigin,'Project dotenv file');
  assert.equal(configuration.summary.keyPresent,true);
});
test('unsupported source modes stop before configuration loading', () => {
  assert.throws(()=>resolveConfiguration('arbitrary',{}), /Choose environment/);
});
