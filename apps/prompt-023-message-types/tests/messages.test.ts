import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SDKUserMessage} from '@anthropic-ai/claude-agent-sdk';
import {classifyMessage,correlateTools,type ObservedEvent} from '../src/messages.js';

test('a documented user wrapper preserves its nested tool-result identity and error flag', () => {
  const message: SDKUserMessage = {type:'user',message:{role:'user',content:[
    {type:'tool_result',tool_use_id:'read-1',content:'Read denied',is_error:true}
  ]},parent_tool_use_id:null,session_id:'classroom-session'};
  const result = classifyMessage(message,3)[0];
  assert.equal(result.messageType,'user');
  assert.equal(result.kind,'tool-result');
  assert.equal(result.toolUseId,'read-1');
  assert.equal(result.isError,true);
  const request: ObservedEvent = {frame:2,messageType:'assistant',kind:'tool-use',title:'Read',text:'{}',toolUseId:'read-1'};
  assert.deepEqual(correlateTools([request,result]),[{toolUseId:'read-1',requestFrame:2,resultFrame:3,isError:true}]);
  assert.equal(correlateTools([result])[0].requestFrame,null);
});
test('ordinary user text remains user content', () => {
  const message: SDKUserMessage = {type:'user',message:{role:'user',content:'Hello'},parent_tool_use_id:null,session_id:'classroom-session'};
  assert.equal(classifyMessage(message,1)[0].kind,'user');
});
