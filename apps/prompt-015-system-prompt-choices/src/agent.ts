import {query} from '@anthropic-ai/claude-agent-sdk';
import {profileOptions, task} from './profiles.js';

export async function runProfile(mode: string) {
  const profile = profileOptions(mode);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  }
  const run = query({
    prompt: task,
    options: {
      ...profile,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: [],
      mcpServers: {},
      settingSources: [],
      maxTurns: 2,
      maxBudgetUsd: 0.20
    }
  });
  let model = '';
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        model = message.model;
      }
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error) {
        const detail = message.subtype === 'success' ? message.result : message.errors.join(' ');
        throw new Error('SDK_RESULT_ERROR · '+detail.slice(0, 2000));
      }
      const usage = message.usage;
      const inputTokens = usage.input_tokens
        + (usage.cache_creation_input_tokens || 0)
        + (usage.cache_read_input_tokens || 0);
      return {
        mode,
        task,
        systemPromptOption: profile.systemPrompt ?? null,
        optionOmitted: !Object.hasOwn(profile, 'systemPrompt'),
        model,
        answer: message.result,
        customPrefixMatched: mode === 'custom' ? message.result.startsWith('TUTOR |') : null,
        inputTokens,
        outputTokens: usage.output_tokens,
        usage,
        sessionId: message.session_id,
        estimatedCostUsd: message.total_cost_usd
      };
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  } finally {
    run.close();
  }
}
