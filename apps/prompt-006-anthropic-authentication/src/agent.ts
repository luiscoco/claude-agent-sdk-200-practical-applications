import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolveConfiguration, requireCredentials } from './auth.js';

export async function runAuthenticatedAgent(prompt: string, mode: string) {
  if (!prompt.trim()) throw new Error('Enter a task before starting the agent.');
  const configuration = resolveConfiguration(mode);
  requireCredentials(configuration);
  const events: {type:string;detail:string}[] = [];
  const run = query({
    prompt,
    options: {
      model: configuration.summary.model,
      env: configuration.environment,
      tools: [], mcpServers: {}, settingSources: [],
      maxTurns: 2, maxBudgetUsd: 0.10
    }
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        events.push({type:'system', detail:`Initialized ${message.model}.`});
      }
      if (message.type === 'assistant') {
        const text = message.message.content
          .filter(block => block.type === 'text')
          .map(block => block.text).join('\n');
        if (text) events.push({type:'assistant', detail:text});
      }
      if (message.type === 'result') {
        if (message.subtype !== 'success' || message.is_error) throw new Error(`The SDK returned ${message.subtype}.`);
        events.push({type:'result', detail:'Successful authenticated SDK result received.'});
        return {answer:message.result, sessionId:message.session_id, estimatedCostUsd:message.total_cost_usd, configuration:configuration.summary, events};
      }
    }
    throw new Error('The SDK stream ended without a successful result.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The SDK run failed.';
    throw new Error(message.replaceAll(configuration.environment.ANTHROPIC_API_KEY, '[REDACTED]'));
  } finally {
    run.close();
  }
}
