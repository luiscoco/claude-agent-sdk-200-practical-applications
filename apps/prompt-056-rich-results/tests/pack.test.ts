import test from 'node:test';
import assert from 'node:assert/strict';
import { digest, nativeOutcome, nativeResource, requestSchema, resourceUri } from '../src/pack.js';
const document = {
  lessonNumber: 56,
  title: 'Classroom resource sample',
  sections: ['Read reference text', 'Inspect embedded JSON', 'Validate structured data'],
};
const text = JSON.stringify(document);
const outcome = {
  ok: true,
  lessonNumber: 56,
  title: document.title,
  sectionCount: 3,
  resourceSha256: digest(text),
  resourceUri,
  errorCode: '',
};

test('native parser finds summary JSON beside a converted resource text block', () => {
  const content = [
    { type: 'text', text: '[Resource from lessons at ' + resourceUri + '] ' + text },
    { type: 'text', text: JSON.stringify(outcome) },
  ];
  assert.deepEqual(nativeOutcome(content), outcome);
  assert.equal(nativeResource(content)?.sha256, outcome.resourceSha256);
  assert.deepEqual(nativeResource(content)?.document, document);
});
test('the resource parser requires the actual native source and URI prefix', () => {
  assert.equal(
    nativeResource([
      { type: 'text', text: '[Resource from other at ' + resourceUri + '] ' + text },
    ]),
    null,
  );
  assert.equal(
    nativeResource([{ type: 'text', text: '[Resource from lessons at course://other] ' + text }]),
    null,
  );
});
test('malformed native data is unavailable', () => {
  assert.equal(nativeOutcome('invalid'), null);
  assert.equal(
    nativeResource([
      { type: 'text', text: '[Resource from lessons at ' + resourceUri + '] invalid' },
    ]),
    null,
  );
});
test('input limits requests to the two classroom pack scenarios', () => {
  assert.ok(requestSchema.safeParse({ pack: 'available' }).success);
  assert.equal(requestSchema.safeParse({ pack: '../other' }).success, false);
});
