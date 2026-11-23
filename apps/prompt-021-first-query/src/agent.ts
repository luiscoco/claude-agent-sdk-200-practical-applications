import {query} from '@anthropic-ai/claude-agent-sdk';
import {validatePrompt} from './prompt.js';

export async function firstQuery(input: unknown) {
  const prompt = validatePrompt(input);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const run = query({prompt,options:{
    model:process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    tools:[],
    mcpServers:{},
    settingSources:[],
    maxTurns:1,
    maxBudgetUsd:0.10
  }});
  let initializedModel = '';
  let availableTools: string[] = [];
  let mcpServers: unknown[] = [];
  let toolUseCount = 0;
  let nativeVersion = '';
  let initialized = false;
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        initialized = true;
        initializedModel = message.model;
        availableTools = message.tools;
        mcpServers = message.mcp_servers;
        nativeVersion = message.claude_code_version;
      }
      if (message.type === 'assistant') toolUseCount += message.message.content.filter(block => block.type === 'tool_use').length;
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error) {
        const detail = message.subtype === 'success' ? message.result : message.errors.join(' ');
        throw new Error('SDK_RESULT_ERROR · '+detail);
      }
      return {prompt,answer:message.result,initializedModel,nativeVersion,availableTools,mcpServers,toolUseCount,
        verified:initialized && message.result.trim().length > 0 && availableTools.length === 0 && mcpServers.length === 0 && toolUseCount === 0,
        sessionId:message.session_id,estimatedCostUsd:message.total_cost_usd};
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  } finally {run.close();}
}
