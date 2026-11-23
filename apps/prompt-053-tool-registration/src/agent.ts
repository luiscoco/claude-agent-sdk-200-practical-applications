import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  createRegisteredServers,
  expectedNames,
  nativeObject,
  outputSchema,
  requestSchema,
  type Execution,
} from './registration.js';

export async function runRegistration(value: unknown) {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('INVALID_INPUT · Select a classroom SKU and a registration mode.');
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const requestedInput = parsed.data;
  const directory = path.resolve(import.meta.dirname, '../runs');
  await mkdir(directory, { recursive: true });
  const workspace = await mkdtemp(path.join(directory, 'registration-'));
  const executions: Execution[] = [];
  const { catalogServer, warehouseServer } = createRegisteredServers(executions);
  const mcpServers: Record<string, McpServerConfig> =
    requestedInput.registration === 'complete'
      ? { catalog: catalogServer, warehouse: warehouseServer }
      : { catalog: catalogServer };
  const allowedTools = [...expectedNames];
  const expectedAvailable =
    requestedInput.registration === 'complete' ? expectedNames : expectedNames.slice(0, 1);
  const expectedMissing = expectedNames.filter((name) => !expectedAvailable.includes(name));
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    toolUseId: string;
    name: string;
    isError: boolean;
    content: unknown;
    parsedOutcome: unknown;
  }> = [];
  const hookResults: Array<{ toolName: string; mcpServer: unknown }> = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let initialTools: string[] = [];
  let sessionId = '';
  let rawOutput: unknown;
  let success = false;
  let resultErrors: string[] = [];
  let error = '';
  try {
    run = query({
      prompt: [
        'For classroom SKU ' +
          requestedInput.sku +
          ', look up its product name, price, stock and shelf.',
        'Expected qualified tools are ' + expectedNames.join(' and ') + '.',
        'Call each expected tool that is actually available exactly once with the given SKU.',
        'Return each actual result in its matching output field. Use null for unavailable results.',
        'List unavailable expected tools in missingTools. Preserve real tool values without guessing.',
      ].join(' '),
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers,
        allowedTools,
        settingSources: [],
        maxTurns: 6,
        maxBudgetUsd: 0.75,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
        },
        systemPrompt:
          'Use the registered classroom lookup tools. Report actual results and explicitly identify unavailable expected tools.',
        hooks: {
          PreToolUse: [
            {
              matcher: 'mcp__.*__lookup',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const args = input.tool_input as Record<string, unknown>;
                  const allowed =
                    expectedAvailable.includes(input.tool_name) &&
                    isDeepStrictEqual(args, { sku: requestedInput.sku });
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
              matcher: 'mcp__.*__lookup',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse')
                    hookResults.push({
                      toolName: input.tool_name,
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
            (item) => item.id === block.tool_use_id && expectedNames.includes(item.name),
          );
          if (call)
            toolResults.push({
              toolUseId: block.tool_use_id,
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
    await Promise.all([catalogServer.instance.close(), warehouseServer.instance.close()]);
  }
  const result = outputSchema.safeParse(rawOutput);
  const output = result.success ? result.data : null;
  const observedNames = initialTools.filter((name) => expectedNames.includes(name));
  const missingTools = expectedNames.filter((name) => !initialTools.includes(name));
  const checks = {
    registrationMatches: isDeepStrictEqual(
      [...observedNames].sort(),
      [...expectedAvailable].sort(),
    ),
    missingNamesMatch: isDeepStrictEqual(missingTools, expectedMissing),
    permissionDidNotRegisterMissingTool: expectedMissing.every(
      (name) => allowedTools.includes(name) && !initialTools.includes(name),
    ),
    handlersObserved: expectedAvailable.every((name) =>
      executions.some(
        (item) =>
          item.qualifiedName === name &&
          item.processId === process.pid &&
          item.input.sku === requestedInput.sku,
      ),
    ),
    nativeResultsMatch:
      executions.length === expectedAvailable.length &&
      executions.every((item) =>
        toolResults.some(
          (native) =>
            native.name === item.qualifiedName &&
            !native.isError &&
            isDeepStrictEqual(native.parsedOutcome, item.outcome),
        ),
      ),
    finalResultsMatch:
      Boolean(output) &&
      isDeepStrictEqual(
        output?.catalog,
        executions.find((item) => item.serverKey === 'catalog')?.outcome ?? null,
      ) &&
      isDeepStrictEqual(
        output?.warehouse,
        executions.find((item) => item.serverKey === 'warehouse')?.outcome ?? null,
      ) &&
      isDeepStrictEqual(output?.missingTools, expectedMissing),
    sdkServersObserved: expectedAvailable.every((name) =>
      hookResults.some(
        (hook) =>
          hook.toolName === name &&
          (hook.mcpServer as { source?: string } | null)?.source === 'sdk',
      ),
    ),
  };
  const secret = process.env.ANTHROPIC_API_KEY;
  if (secret) {
    error = error.replaceAll(secret, '[REDACTED]');
    resultErrors = resultErrors.map((message) => message.replaceAll(secret, '[REDACTED]'));
  }
  return {
    requestedInput,
    registrationKeys: Object.keys(mcpServers),
    serverMetadataNames: ['catalog-service', 'warehouse-service'],
    allowedTools,
    expectedNames,
    observedNames,
    missingTools,
    initialTools,
    executions,
    hostProcessId: process.pid,
    calls,
    toolResults,
    hookResults,
    output,
    success,
    error,
    resultErrors,
    sessionId,
    checks,
    verified: !error && success && Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
  };
}
