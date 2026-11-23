import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRegisteredServers,
  expectedNames,
  nativeObject,
  requestSchema,
} from '../src/registration.js';

test('the two local lookup names have distinct fully qualified names', () => {
  assert.equal(new Set(expectedNames).size, 2);
  assert.deepEqual(expectedNames, ['mcp__catalog__lookup', 'mcp__warehouse__lookup']);
});
test('request input rejects unknown SKUs, modes and extra fields', () => {
  assert.ok(requestSchema.safeParse({ sku: 'MIC-101', registration: 'complete' }).success);
  for (const value of [
    { sku: 'OTHER', registration: 'complete' },
    { sku: 'MIC-101', registration: 'other' },
    { sku: 'MIC-101', registration: 'complete', extra: true },
  ]) {
    assert.equal(requestSchema.safeParse(value).success, false);
  }
});
test('both factories create actual SDK servers with internal metadata names', async () => {
  const servers = createRegisteredServers([]);
  assert.equal(servers.catalogServer.type, 'sdk');
  assert.equal(servers.catalogServer.name, 'catalog-service');
  assert.equal(servers.warehouseServer.name, 'warehouse-service');
  await Promise.all([
    servers.catalogServer.instance.close(),
    servers.warehouseServer.instance.close(),
  ]);
});
test('native content parser accepts text and text blocks', () => {
  assert.deepEqual(nativeObject('{"available":12}'), { available: 12 });
  assert.deepEqual(nativeObject([{ type: 'text', text: '{"priceCents":7900}' }]), {
    priceCents: 7900,
  });
  assert.equal(nativeObject('invalid'), null);
});
