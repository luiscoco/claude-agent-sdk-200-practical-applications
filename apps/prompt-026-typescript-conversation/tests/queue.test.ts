import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SDKUserMessage} from '@anthropic-ai/claude-agent-sdk';
import {MessageQueue} from '../src/queue.js';
const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';
const message: SDKUserMessage = {type:'user',uuid:firstId,origin:{kind:'human'},message:{role:'user',content:'Hello'},parent_tool_use_id:null};
test('the input queue wakes a waiting consumer and preserves message order', async () => {
  const queue = new MessageQueue();const iterator = queue.messages();const waiting = iterator.next();
  queue.push(message);queue.push({...message,uuid:secondId});
  assert.equal((await waiting).value?.uuid,firstId);assert.equal((await iterator.next()).value?.uuid,secondId);
  const ending = iterator.next();queue.end();assert.equal((await ending).done,true);
  assert.throws(() => queue.push(message),/INPUT_CLOSED/);
});
test('ending an input queue drains already queued messages', async () => {
  const queue = new MessageQueue();queue.push(message);queue.end();const messages = [];
  for await (const value of queue.messages()) messages.push(value);
  assert.equal(messages.length,1);
});
