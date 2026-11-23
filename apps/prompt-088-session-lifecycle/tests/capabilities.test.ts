import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilities } from '../src/capabilities.js';
test('Declared event support cannot turn a zero native observation count into an observed event', () => {
  const rows = capabilities({ ConfigChange: 1 });
  assert.equal(rows.find((row) => row.event === 'SessionStart')?.installedTypeScriptEvent, true);
  assert.equal(
    rows.find((row) => row.event === 'SessionStart')?.observation,
    'Not observed in this run',
  );
  assert.equal(
    rows.find((row) => row.event === 'ConfigChange')?.observation,
    'Observed in this run',
  );
  assert.equal(rows.find((row) => row.event === 'SessionStart')?.pythonCallbackDocumented, false);
  assert.equal(rows.find((row) => row.event === 'Notification')?.pythonCallbackDocumented, true);
});
