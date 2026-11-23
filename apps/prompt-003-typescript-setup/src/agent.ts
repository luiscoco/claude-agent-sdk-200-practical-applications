import { query } from '@anthropic-ai/claude-agent-sdk';

export async function runAgent(prompt: string) {
  if (!prompt.trim()) throw new Error('Enter a task before starting a model run.');
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error('Set ANTHROPIC_API_KEY in your local environment before running the agent.');
  }

  const events: {type:string;detail:string}[] = [];
  const run = query({
    prompt,
    options: {
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: [],
      mcpServers: {},
      settingSources: [],
      maxTurns: 2,
      maxBudgetUsd: 0.10
    }
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        events.push({type:'system',detail:`Initialized ${message.model}. Tools exposed: ${message.tools.length}.`});
      }
      if (message.type === 'assistant') {
        const text = message.message.content.filter(block=>block.type==='text').map(block=>block.text).join('\n');
        if (text) events.push({type:'assistant',detail:text});
      }
      if (message.type === 'result') {
        if (message.subtype !== 'success' || message.is_error) {
          throw new Error(`The SDK returned ${message.subtype}.`);
        }
        events.push({type:'result',detail:'Successful SDK result received.'});
        return {answer:message.result,sessionId:message.session_id,estimatedCostUsd:message.total_cost_usd,events};
      }
    }
    throw new Error('The SDK stream ended without a successful result.');
  } finally {
    run.close();
  }
}
