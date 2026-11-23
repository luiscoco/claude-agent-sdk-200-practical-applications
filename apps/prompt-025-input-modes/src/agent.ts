import {query,type Options,type Query} from '@anthropic-ai/claude-agent-sdk';
import {prepareTask,userMessages,type InputEvent} from './input.js';

export async function runInputMode(mode: unknown,left: unknown,right: unknown) {
  if (mode !== 'string' && mode !== 'streaming' && mode !== 'generator-error') throw new Error('INVALID_MODE · Select string, streaming, or generator-error.');
  const task = prepareTask(left,right);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const inputEvents: InputEvent[] = [];
  const prompt = mode === 'string' ? task.prompt
    : userMessages(task.prompt,mode === 'generator-error',inputEvents);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),120000);
  const options: Options = {model:process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',tools:[],mcpServers:{},settingSources:[],
    maxTurns:1,maxBudgetUsd:0.10,abortController:controller};
  let run: Query | undefined;
  const events: {type:string;subtype?:string}[] = [];
  let initializedModel = '';
  let answer = '';
  let sdkError = '';
  let resultReceived = false;
  try {
    run = query({prompt,options});
    for await (const message of run) {
      events.push({type:message.type,...('subtype' in message ? {subtype:message.subtype} : {})});
      if (message.type === 'system' && message.subtype === 'init') initializedModel = message.model;
      if (message.type !== 'result') continue;
      resultReceived = true;
      if (message.subtype !== 'success' || message.is_error) {
        sdkError = message.subtype === 'success' ? message.result : message.errors.join(' ');
      } else answer = message.result;
    }
  } catch (error) {sdkError = error instanceof Error ? error.message : String(error);}
  finally {clearTimeout(timeout);run?.close();}
  const generatorError = inputEvents.find(event => event.kind === 'error')?.message || '';
  const success = resultReceived && !sdkError;
  const verified = mode === 'generator-error' ? Boolean(generatorError && sdkError)
    : success && /^[+-]?\d+$/.test(answer.trim()) && Number(answer.trim()) === task.expected;
  return {mode,inputType:mode === 'string' ? 'string' : 'AsyncIterable<SDKUserMessage>',task,initializedModel,events,
    inputEvents,answer,sdkError,generatorError,success,verified,checkedAt:new Date().toISOString()};
}
