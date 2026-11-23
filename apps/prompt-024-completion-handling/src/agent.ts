import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {query,type Options,type Query,type SDKResultMessage} from '@anthropic-ai/claude-agent-sdk';
import {completionOutcome,exceptionOutcome,type ApplicationOutcome} from './outcome.js';

export const root = path.resolve(import.meta.dirname,'..');
const modes = ['success','result-error','turn-limit','exception'];

export async function runCompletion(mode: unknown) {
  let run: Query | undefined;
  let outcome!: ApplicationOutcome;
  let nativeResult: SDKResultMessage | null = null;
  const observations: {type:string;subtype?:string}[] = [];
  let cleanupCalled = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),120000);
  try {
    if (typeof mode !== 'string' || !modes.includes(mode)) throw new Error('INVALID_MODE · Select one of the four completion experiments.');
    if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
    const file = await realpath(path.join(root,'fixtures/number.txt'));
    const options: Options = {
      cwd:root,model:mode === 'result-error' ? 'claude-course-missing-model' : model,
      tools:mode === 'turn-limit' ? ['Read'] : [],
      allowedTools:mode === 'turn-limit' ? ['Read'] : [],
      mcpServers:{},settingSources:[],maxTurns:1,maxBudgetUsd:0.20,abortController:controller,
      ...(mode === 'exception' ? {fallbackModel:model} : {})
    };
    const prompt = mode === 'turn-limit'
      ? 'Use Read to read '+JSON.stringify(file)+' and then report twice the number from that file.'
      : 'Reply with exactly COMPLETED.';
    run = query({prompt,options});
    for await (const message of run) {
      observations.push({type:message.type,...('subtype' in message ? {subtype:message.subtype} : {})});
      if (message.type !== 'result') continue;
      nativeResult = message;
      outcome = completionOutcome(message);
      break;
    }
    if (!nativeResult) throw new Error('NO_RESULT · The SDK stream ended without a result message.');
  } catch (error) {
    outcome = exceptionOutcome(error);
  } finally {
    clearTimeout(timeout);
    if (run) {run.close();cleanupCalled = true;}
  }
  const verified = mode === 'success' ? outcome.ok && Boolean(outcome.answer?.trim())
    : mode === 'result-error' ? outcome.category === 'sdk-result-error' && nativeResult?.is_error === true
      : mode === 'turn-limit' ? outcome.category === 'sdk-result-error' && nativeResult?.subtype === 'error_max_turns'
        && nativeResult.permission_denials.length === 0 && observations.some(message => message.type === 'user')
        : mode === 'exception' && outcome.category === 'exception' && observations.length === 0;
  return {mode,outcome,nativeResult,observations,cleanupCalled,verified,checkedAt:new Date().toISOString()};
}
