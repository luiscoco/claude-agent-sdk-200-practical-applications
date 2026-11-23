import type {SDKUserMessage} from '@anthropic-ai/claude-agent-sdk';

export type InputEvent = {kind:'message';message:SDKUserMessage} | {kind:'error';message:string};

export function prepareTask(left: unknown,right: unknown) {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) throw new Error('INVALID_NUMBERS · Enter two safe integers.');
  const first = left as number;
  const second = right as number;
  if (!Number.isSafeInteger(first + second)) throw new Error('INVALID_SUM · Choose a sum within the safe integer range.');
  return {left:first,right:second,expected:first+second,
    prompt:'Add '+first+' and '+second+'. Reply using only the integer sum, with no punctuation.'};
}

export async function* userMessages(prompt: string,broken: boolean,events: InputEvent[]): AsyncGenerator<SDKUserMessage> {
  if (broken) {
    const error = new Error('CLASSROOM_GENERATOR_ERROR · The input generator could not prepare its message.');
    events.push({kind:'error',message:error.message});
    throw error;
  }
  const message: SDKUserMessage = {type:'user',message:{role:'user',content:prompt},parent_tool_use_id:null};
  events.push({kind:'message',message});
  yield message;
}
