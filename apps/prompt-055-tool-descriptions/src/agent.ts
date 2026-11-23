import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  createRecordServer,
  descriptions,
  nativeObject,
  requestSchema,
  resultSchema,
  testCases,
  toolNames,
  type Case,
  type DescriptionMode,
  type Execution,
} from './descriptions.js';

async function runCase(testCase: Case, mode: DescriptionMode, directory: string) {
  const workspace = await mkdtemp(path.join(directory, 'selection-'));
  const executions: Execution[] = [];
  const server = createRecordServer(mode, executions);
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    name: string;
    isError: boolean;
    content: unknown;
    parsedOutcome: unknown;
  }> = [];
  const hookResults: Array<{ name: string; mcpServer: unknown }> = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let initialTools: string[] = [];
  let sessionId = '';
  let rawOutput: unknown;
  let success = false;
  let resultErrors: string[] = [];
  let error = '';
  let approvedCalls = 0;
  try {
    run = query({
      prompt:
        'Choose one registered record tool for this question. Call it exactly once with query equal to the exact question text. Preserve its actual source and all returned facts as structured output. Question text follows.\n' +
        testCase.question,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: { records: server },
        allowedTools: Object.values(toolNames),
        settingSources: [],
        maxTurns: 5,
        maxBudgetUsd: 0.5,
        abortController: controller,
        systemPrompt:
          'Select a record tool using the available tool descriptions and the user question. Make one record lookup and preserve its actual returned data.',
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(resultSchema, { target: 'draft-7' }),
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'mcp__records__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const allowed =
                    approvedCalls === 0 &&
                    Object.values(toolNames).includes(input.tool_name) &&
                    isDeepStrictEqual(input.tool_input, { query: testCase.question });
                  if (allowed) approvedCalls++;
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: allowed ? 'allow' : 'deny',
                    },
                  };
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'mcp__records__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse')
                    hookResults.push({
                      name: input.tool_name,
                      mcpServer: input.mcp_server ?? null,
                    });
                  return {};
                },
              ],
            },
          ],
        },
      },
    });
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') initialTools = message.tools;
      if (message.type === 'assistant')
        for (const block of message.message.content) {
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
        }
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = calls.find(
            (item) => item.id === block.tool_use_id && Object.values(toolNames).includes(item.name),
          );
          if (call)
            toolResults.push({
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
              parsedOutcome: nativeObject(block.content),
            });
        }
      if (message.type === 'result') {
        sessionId = message.session_id;
        success = message.subtype === 'success' && !message.is_error;
        resultErrors = success
          ? []
          : message.subtype === 'success'
            ? [message.result]
            : message.errors;
        rawOutput = message.subtype === 'success' ? message.structured_output : undefined;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
    await server.instance.close();
  }
  const parsed = resultSchema.safeParse(rawOutput);
  const output = parsed.success ? parsed.data : null;
  const execution = executions[0];
  const selectedTool = execution ? toolNames[execution.source] : null;
  const checks = {
    bothToolsDiscovered: Object.values(toolNames).every((name) => initialTools.includes(name)),
    oneActualHandler:
      executions.length === 1 &&
      execution.processId === process.pid &&
      execution.query === testCase.question,
    nativeResultMatches:
      Boolean(execution) &&
      toolResults.some(
        (result) =>
          result.name === selectedTool &&
          !result.isError &&
          isDeepStrictEqual(result.parsedOutcome, execution.outcome),
      ),
    finalResultMatches: Boolean(execution) && isDeepStrictEqual(output, execution.outcome),
    sdkServerObserved: hookResults.some(
      (hook) =>
        hook.name === selectedTool &&
        (hook.mcpServer as { name?: string; source?: string } | null)?.name === 'records' &&
        (hook.mcpServer as { source?: string } | null)?.source === 'sdk',
    ),
  };
  const secret = process.env.ANTHROPIC_API_KEY;
  if (secret) {
    error = error.replaceAll(secret, '[REDACTED]');
    resultErrors = resultErrors.map((message) => message.replaceAll(secret, '[REDACTED]'));
  }
  return {
    id: testCase.id,
    question: testCase.question,
    expectedTool: toolNames[testCase.expected],
    selectedTool,
    selectionCorrect: selectedTool === toolNames[testCase.expected],
    executions,
    calls,
    toolResults,
    hookResults,
    initialTools,
    output,
    success,
    sessionId,
    error,
    resultErrors,
    checks,
    flowVerified: !error && success && Object.values(checks).every(Boolean),
  };
}

export async function runDescriptionSuite(value: unknown) {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('INVALID_INPUT · Select a description mode and a classroom test suite.');
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const requestedInput = parsed.data;
  const directory = path.resolve(import.meta.dirname, '../runs');
  await mkdir(directory, { recursive: true });
  const trials = [];
  for (const testCase of testCases[requestedInput.suite])
    trials.push(await runCase(testCase, requestedInput.descriptionMode, directory));
  const correct = trials.filter((trial) => trial.selectionCorrect).length;
  return {
    requestedInput,
    actualDescriptions: descriptions[requestedInput.descriptionMode],
    toolNames,
    trials,
    correct,
    total: trials.length,
    accuracy: correct / trials.length,
    verified: trials.every((trial) => trial.flowVerified),
    allSelectionsCorrect: correct === trials.length,
    hostProcessId: process.pid,
    checkedAt: new Date().toISOString(),
  };
}
