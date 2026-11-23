import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNumbers, calculateStatistics, validateModelResult, LessonError } from '../src/numbers.js';
test('classroom sample has independently known statistics',()=>{
  assert.deepEqual(calculateStatistics(parseNumbers('12\n8\n15\n5\n10')), {count:5,total:50,min:5,max:15});
});
test('CRLF, blanks, signs and negative numbers',()=>{
  assert.deepEqual(calculateStatistics(parseNumbers(' -4\r\n\r\n+6\r\n0 ')),{count:3,total:2,min:-4,max:6});
});
test('invalid input identifies the actual source line',()=>{
  assert.throws(()=>parseNumbers('12\n8\nfifteen'),e=>e instanceof LessonError&&e.code==='INVALID_NUMBER'&&e.line===3);
});
test('empty, oversize and unsafe inputs are rejected',()=>{
  for(const input of ['', '9007199254740992', Array(51).fill('1').join('\n'), ' '.repeat(16385)]) assert.throws(()=>parseNumbers(input),LessonError);
  assert.throws(()=>calculateStatistics([Number.MAX_SAFE_INTEGER,1]),/safe integer/);
});
test('model arithmetic cannot bypass independent verification',()=>{
  const reference={count:5,total:50,min:5,max:15};
  assert.throws(()=>validateModelResult({...reference,total:51},reference),/rejected total/);
  assert.throws(()=>validateModelResult({...reference,count:'5'},reference),/safe integer/);
  assert.deepEqual(validateModelResult(reference,reference),reference);
});
