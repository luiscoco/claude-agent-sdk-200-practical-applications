import {query} from '@anthropic-ai/claude-agent-sdk';
import {readFile} from 'node:fs/promises';
import {validateModel} from './models.js';

export const task = 'Reply with exactly MODEL_OK.';

export async function runModel(selectedModel: unknown) {
  const requestedModel = validateModel(selectedModel);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const environment = {...process.env};
  const project = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const versions = {configuredSdk:project.dependencies['@anthropic-ai/claude-agent-sdk'] as string, nativeRuntime:'', node:process.version};
  for (const name of ['CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY','CLAUDE_CODE_USE_MANTLE','ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','ANTHROPIC_DEFAULT_HAIKU_MODEL']) delete environment[name];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  const run = query({prompt:task, options:{
    model:requestedModel,
    env:environment,
    settingSources:[], tools:[], mcpServers:{},
    systemPrompt:'Follow the requested short response format.',
    maxTurns:2, maxBudgetUsd:0.20, abortController:controller
  }});
  let initializedModel = '';
  const assistantModels = new Set<string>();
  let pickerModels: {value:string; resolvedModel?:string; displayName:string}[] = [];
  try {
    pickerModels = (await run.supportedModels()).map(({value,resolvedModel,displayName}) => ({value,resolvedModel,displayName}));
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        initializedModel = message.model;
        versions.nativeRuntime = message.claude_code_version;
      }
      if (message.type === 'assistant') assistantModels.add(message.message.model);
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error) {
        const detail = message.subtype === 'success' ? message.result : message.errors.join(' ');
        return {requestedModel, initializedModel, assistantModels:[...assistantModels], pickerModels,
          provider:'Anthropic API', versions, task, success:false, error:detail, verified:false,
          sessionId:message.session_id, checkedAt:new Date().toISOString(), modelUsage:message.modelUsage};
      }
      return {requestedModel, initializedModel, assistantModels:[...assistantModels], pickerModels,
        provider:'Anthropic API', versions, task, success:true, answer:message.result,
        verified:message.result.trim() === 'MODEL_OK' && assistantModels.size > 0,
        modelUsage:message.modelUsage, estimatedCostUsd:message.total_cost_usd,
        sessionId:message.session_id, checkedAt:new Date().toISOString()};
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  } catch (error) {
    return {requestedModel, initializedModel, assistantModels:[...assistantModels], pickerModels,
      provider:'Anthropic API', versions, task, success:false,
      error:error instanceof Error ? error.message : 'SDK transport failed.',
      verified:false, checkedAt:new Date().toISOString()};
  } finally { clearTimeout(timeout); run.close(); }
}
