import path from 'node:path';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { capabilityReport, configuredTools, requireTool } from './inventory.js';

const root = path.resolve(import.meta.dirname, '..');
export async function inspectInventory(mode: unknown) {
  const requestedTools = configuredTools(mode);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let nativeInitialization: {
    tools: string[];
    sessionId: string;
    nativeVersion: string;
    model: string;
  } | null = null;
  let success = false;
  let answer = '';
  let error = '';
  try {
    run = query({
      prompt: 'Reply exactly INVENTORY_READY. Do not call tools.',
      options: {
        cwd: root,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: requestedTools,
        mcpServers: {},
        settingSources: [],
        maxTurns: 1,
        maxBudgetUsd: 0.25,
        abortController: controller,
        systemPrompt: 'Acknowledge this inventory inspection without using tools.',
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init')
        nativeInitialization = {
          tools: message.tools,
          sessionId: message.session_id,
          nativeVersion: message.claude_code_version,
          model: message.model,
        };
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timeout);
    run?.close();
  }
  const availableTools = nativeInitialization?.tools ?? [];
  return {
    mode,
    requestedTools,
    nativeInitialization,
    availableTools,
    capabilities: capabilityReport(availableTools),
    success,
    answer,
    error,
    verified:
      Boolean(nativeInitialization) &&
      success &&
      !error &&
      answer.includes('INVENTORY_READY') &&
      requestedTools.every((tool) => availableTools.includes(tool)),
    checkedAt: new Date().toISOString(),
  };
}
export type Inventory = Awaited<ReturnType<typeof inspectInventory>>;
export async function executeExample(inventory: Inventory) {
  if (!inventory.verified)
    throw new Error('INVALID_INVENTORY · Inspect a successful native session first.');
  try {
    requireTool(inventory.availableTools, 'Read');
  } catch (failure) {
    return {
      inventory,
      sdkStarted: false,
      actualTools: [] as string[],
      toolCalls: [] as Array<{ name: string; input: unknown }>,
      answer: '',
      error: failure instanceof Error ? failure.message : String(failure),
      blocked: true,
      verified: true,
      checkedAt: new Date().toISOString(),
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let actualTools: string[] = [];
  const toolCalls: Array<{ name: string; input: unknown }> = [];
  let answer = '';
  let success = false;
  let error = '';
  let sessionId = '';
  try {
    run = query({
      prompt:
        'Use Read to inspect ' +
        path.join(root, 'fixtures/lesson-total.ts') +
        '. Summarize the function name, its calculation, the example total and INVENTORY-041 marker in at most fifty words.',
      options: {
        cwd: root,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Read'],
        allowedTools: ['Read'],
        mcpServers: {},
        settingSources: [],
        maxTurns: 4,
        maxBudgetUsd: 0.5,
        abortController: controller,
        systemPrompt: 'Read the supplied source before summarizing its exact observable facts.',
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') actualTools = message.tools;
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use') toolCalls.push({ name: block.name, input: block.input });
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
        sessionId = message.session_id;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timeout);
    run?.close();
  }
  const factsMatched = ['calculateLessonTotal', '40', 'INVENTORY-041'].every((fact) =>
    answer.includes(fact),
  );
  return {
    inventory,
    sdkStarted: true,
    actualTools,
    toolCalls,
    sessionId,
    answer,
    error,
    blocked: false,
    factsMatched,
    verified:
      success &&
      !error &&
      actualTools.includes('Read') &&
      toolCalls.some((tool) => tool.name === 'Read') &&
      factsMatched,
    checkedAt: new Date().toISOString(),
  };
}
