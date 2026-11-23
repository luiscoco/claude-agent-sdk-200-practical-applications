import {test} from 'node:test';
import assert from 'node:assert/strict';
import {add} from '../src/calculator.mjs';

test('adds positive numbers', () => assert.equal(add(2, 3), 5));
test('adds negative numbers', () => assert.equal(add(-4, -2), -6));
test('handles zero', () => assert.equal(add(0, 7), 7));
