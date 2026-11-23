import {query} from '@anthropic-ai/claude-agent-sdk';
import {configuration} from './config.js';
import {readFallbackNotice, type FallbackNotice} from './events.js';

export async function runFallback(mode: string) {
  const selected = configuration(mode);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const environment = {...process.env};
  for (const name of ['CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY','CLAUDE_CODE_USE_MANTLE','ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','ANTHROPIC_DEFAULT_HAIKU_MODEL']) delete environment[name];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),120000);
  const events: unknown[] = [];
  const fallbackNotices: FallbackNotice[] = [];
  const run = query({prompt:'Reply with exactly FALLBACK_OK.',options:{
    ...selected,env:environment,settingSources:[],tools:[],mcpServers:{},
    systemPrompt:'Follow the requested short response format.',
    maxTurns:2,maxBudgetUsd:0.20,abortController:controller
  }});
  let initializedModel = '';
  let nativeVersion = '';
  const responseModels = new Set<string>();
  try {
    for await (const message of run) {
      const fallback = readFallbackNotice(message);
      if (fallback) {
        fallbackNotices.push(fallback);
        events.push(fallback);
        continue;
      }
      if (message.type === 'system' && message.subtype === 'init') {
        initializedModel = message.model; nativeVersion = message.claude_code_version;
        events.push({type:'init',model:message.model});
      } else if (message.type === 'assistant') {
        const text = message.message.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
        events.push({type:'assistant',model:message.message.model,error:message.error,text});
        if (message.message.model !== '<synthetic>') responseModels.add(message.message.model);
      } else if (message.type === 'result') {
        const success = message.subtype === 'success' && !message.is_error;
        const answer = message.subtype === 'success' ? message.result : '';
        const error = success ? '' : message.subtype === 'success' ? message.result : message.errors.join(' ');
        const fallbackOccurred = fallbackNotices.length > 0;
        const finalModel = [...responseModels].at(-1) || '';
        const verified = mode === 'disabled' ? !success && error.length > 0 && !fallbackOccurred
          : success && answer.trim() === 'FALLBACK_OK'
            && (mode === 'healthy' ? finalModel === selected.model && !fallbackOccurred
              : fallbackOccurred && fallbackNotices[0].original_model === selected.model
                && fallbackNotices.at(-1)?.fallback_model === finalModel);
        return {mode,selected,initializedModel,nativeVersion,events,fallbackNotices,fallbackOccurred,finalModel,verified,responseModels:[...responseModels],success,answer,error,
          modelUsage:message.modelUsage,sessionId:message.session_id,estimatedCostUsd:message.total_cost_usd,
          checkedAt:new Date().toISOString()};
      } else if (message.type === 'system') events.push(message);
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  } finally {clearTimeout(timeout);run.close();}
}
