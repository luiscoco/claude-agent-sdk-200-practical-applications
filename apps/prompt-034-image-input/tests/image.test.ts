import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateImage, validateQuestion } from '../src/image.js';

test('the original PNG has matching metadata and raw base64 image content', async () => {
  const bytes = await readFile(new URL('../public/assets/main-infographic.png', import.meta.url));
  const image = validateImage('image/png', bytes.toString('base64'));
  assert.equal(image.bytes, bytes.length);
  assert.throws(() => validateImage('image/jpeg', image.data), /MIME_MISMATCH/);
  assert.throws(
    () => validateImage('image/png', 'data:image/png;base64,' + image.data),
    /INVALID_IMAGE_DATA/,
  );
  assert.throws(() => validateImage('image/png', '!invalid!'), /INVALID_IMAGE_DATA/);
  assert.throws(() => validateImage('text/plain', image.data), /UNSUPPORTED_MEDIA_TYPE/);
});
test('questions preserve user text and reject unsupported values', () => {
  assert.equal(validateQuestion('  Describe the diagram  '), 'Describe the diagram');
  for (const value of ['', null, ['text'], 'x'.repeat(2001)])
    assert.throws(() => validateQuestion(value), /INVALID_QUESTION/);
});
