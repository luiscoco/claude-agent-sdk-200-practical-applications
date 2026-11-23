import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {query, type Options} from '@anthropic-ai/claude-agent-sdk';
import {domainPolicy, expectedRecommendations, inventoryFile, loadInventory, root, verifyRecommendations} from './inventory.js';

export async function runInventoryAgent(extend: boolean) {
  if (typeof extend !== 'boolean') throw new Error('INVALID_POLICY_SELECTION · Choose whether the policy is appended.');
  const products = await loadInventory();
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const target = await realpath(inventoryFile);
  const events: {type:string; data:unknown}[] = [];
  let readCalls = 0;

  async function permittedRead(name: string, input: unknown) {
    if (name !== 'Read' || !input || typeof input !== 'object') return false;
    const requested = (input as Record<string, unknown>).file_path;
    if (typeof requested !== 'string') return false;
    try {
      const actual = await realpath(path.resolve(root, requested));
      return process.platform === 'win32' ? actual.toLowerCase() === target.toLowerCase() : actual === target;
    } catch {
      return false;
    }
  }

  const options: Options = {
    cwd: root,
    systemPrompt: {type:'preset', preset:'claude_code', ...(extend ? {append:domainPolicy} : {})},
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    tools: ['Read'],
    mcpServers: {},
    settingSources: [],
    maxTurns: 5,
    maxBudgetUsd: 0.50,
    canUseTool: async (name, input) => name === 'StructuredOutput' || await permittedRead(name, input)
      ? {behavior:'allow', updatedInput:input}
      : {behavior:'deny', message:'The classroom application permits reading only inventory.json.'},
    hooks: {
      PreToolUse: [{hooks:[async input => {
        if (input.hook_event_name !== 'PreToolUse' || input.tool_name === 'StructuredOutput') return {};
        if (await permittedRead(input.tool_name, input.tool_input)) return {};
        return {hookSpecificOutput:{hookEventName:'PreToolUse', permissionDecision:'deny', permissionDecisionReason:'Only inventory.json is permitted by this application.'}};
      }]}],
      PostToolUse: [{matcher:'Read', hooks:[async input => {
        if (input.hook_event_name !== 'PostToolUse') return {};
        readCalls++;
        events.push({type:'read_completed', data:input.tool_response});
        return {};
      }]}]
    },
    outputFormat: {type:'json_schema', schema:{
      type:'object',
      properties:{recommendations:{type:'array', items:{
        type:'object',
        properties:{sku:{type:'string'}, needed:{type:'integer'}, proposed:{type:'integer'}},
        required:['sku','needed','proposed'],
        additionalProperties:false
      }}},
      required:['recommendations'],
      additionalProperties:false
    }}
  };
  const run = query({
    prompt: `Use Read to inspect ${JSON.stringify(inventoryFile)}. For every product, needed is max(0,target-stock) when stock is below reorderPoint, otherwise zero. Proposed equals needed subject to any supplied purchase policy. Return one recommendation for every SKU.`,
    options
  });
  try {
    for await (const message of run) {
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error) {
        const detail = message.subtype === 'success' ? message.result : message.errors.join(' ');
        throw new Error('SDK_RESULT_ERROR · '+detail.slice(0, 2000));
      }
      if (!readCalls) throw new Error('READ_NOT_OBSERVED · A completed inventory Read is required.');
      const recommendations = (message.structured_output as {recommendations:unknown} | undefined)?.recommendations;
      if (!Array.isArray(recommendations)) {
        throw new Error('INVALID_AGENT_RESULT · The SDK result must contain a recommendations array.');
      }
      const expected = expectedRecommendations(products, extend);
      return {
        extend, products, recommendations, expected,
        verified: verifyRecommendations(recommendations, expected),
        readCalls, events,
        systemPromptOption: options.systemPrompt,
        sessionId: message.session_id,
        estimatedCostUsd: message.total_cost_usd
      };
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  } finally {
    run.close();
  }
}
