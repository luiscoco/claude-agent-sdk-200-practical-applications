import path from 'node:path';
import { mkdir, mkdtemp, readFile, copyFile, access } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { nativeOutcome, outcomeSchema, toolInputSchema } from './catalog.js';
import { requestSchema, prepareConfiguration } from './configuration.js';

export async function runConfiguration(value: unknown) {
  const parsedInput = requestSchema.safeParse(value);
  if (!parsedInput.success)
    throw new Error(
      'INVALID_INPUT · Enter a valid classroom lesson slug. ' + parsedInput.error.message,
    );
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const requestedInput = parsedInput.data;
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/configuration-'));
  const expectedToolInput = { slug: requestedInput.slug };
  const auditFile = path.join(workspace, 'handler-audit.jsonl');
  const catalogFile = path.join(workspace, 'catalog.json');
  await copyFile(path.join(root, 'fixtures/catalog.json'), catalogFile);
  let prepared: Awaited<ReturnType<typeof prepareConfiguration>>;
  try {
    prepared = await prepareConfiguration(root, workspace, requestedInput.mode);
  } catch (failure) {
    const error = failure instanceof Error ? failure.message : String(failure);
    return {
      requestedInput,
      stage: 'configuration-preflight',
      sdkStarted: false,
      connection: { type: 'stdio', strictEnabled: requestedInput.mode === 'strict' },
      nativeServerStatus: [],
      initialTools: [],
      calls: [],
      executions: [],
      toolResults: [],
      hookResults: [],
      connectionChecks: {
        configurationFailureObserved: Boolean(error),
        sdkSkippedAfterInvalidFile: true,
      },
      checks: {},
      connectionVerified: false,
      output: null,
      sessionId: '',
      success: false,
      resultStatus: '',
      resultErrors: [],
      error,
      hostProcessId: process.pid,
      verified: requestedInput.mode === 'malformed' && Boolean(error),
      checkedAt: new Date().toISOString(),
    };
  }
  const server = prepared.loaded.mcpServers.catalog;
  if (!server) throw new Error('The explicit configuration file must define catalog.');
  const strictEnabled = requestedInput.mode === 'strict';
  const toolName = 'mcp__catalog__get_lesson';
  const permitted = (name: string, input: Record<string, unknown>) => {
    const parsed = toolInputSchema.safeParse(input);
    return name === toolName && parsed.success && isDeepStrictEqual(parsed.data, expectedToolInput);
  };
  let nativeServerStatus: Awaited<ReturnType<Query['mcpServerStatus']>> = [];
  const assistantText: string[] = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    toolUseId: string;
    isError: boolean;
    content: unknown;
    parsedOutcome: ReturnType<typeof nativeOutcome>;
    structuredContent: unknown;
  }> = [];
  const hookResults: Array<{
    event: string;
    mcpServer: unknown;
    response?: unknown;
    error?: string;
  }> = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);
  let run: Query | undefined;
  let initialTools: string[] = [];
  let sessionId = '';
  let rawOutput: unknown;
  let success = false;
  let resultStatus = '';
  let resultErrors: string[] = [];
  let error = '';
  try {
    run = query({
      prompt:
        'Use ' +
        toolName +
        ' exactly once with the exact arguments ' +
        JSON.stringify(expectedToolInput) +
        '. Preserve the actual local stdio tool outcome, including its process ID and any missing-lesson error. Return that same outcome as structured output.',
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: prepared.loaded.mcpServers,
        strictMcpConfig: strictEnabled,
        settings: { enableAllProjectMcpServers: true },
        allowedTools: [toolName],
        settingSources: ['project'],
        env: {
          ...process.env,
          MCP_TIMEOUT: '60000',
          MCP_CONNECTION_NONBLOCKING: '0',
          MCP_CONNECT_TIMEOUT_MS: '60000',
          CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
        },
        maxTurns: 5,
        maxBudgetUsd: 0.75,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outcomeSchema, { target: 'draft-7' }),
        },
        systemPrompt:
          'Call the registered catalog tool with the exact requested slug. Preserve the actual tool response or domain error and all returned fields.',
        hooks: {
          PreToolUse: [
            {
              matcher: 'mcp__.*',
              hooks: [
                async (input) =>
                  input.hook_event_name === 'PreToolUse'
                    ? {
                        hookSpecificOutput: {
                          hookEventName: 'PreToolUse',
                          permissionDecision: permitted(
                            input.tool_name,
                            input.tool_input as Record<string, unknown>,
                          )
                            ? 'allow'
                            : 'deny',
                        },
                      }
                    : {},
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: toolName,
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse')
                    hookResults.push({
                      event: input.hook_event_name,
                      mcpServer: input.mcp_server ?? null,
                      response: input.tool_response,
                    });
                  return {};
                },
              ],
            },
          ],
          PostToolUseFailure: [
            {
              matcher: toolName,
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUseFailure')
                    hookResults.push({
                      event: input.hook_event_name,
                      mcpServer: input.mcp_server ?? null,
                      error: input.error,
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
      if (message.type === 'system' && message.subtype === 'init') {
        initialTools = message.tools;
        nativeServerStatus = await run.mcpServerStatus();
      }
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'text') assistantText.push(block.text);
          else if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (
            block.type !== 'tool_result' ||
            !calls.some((call) => call.id === block.tool_use_id && call.name === toolName)
          )
            continue;
          const metadata = message.tool_use_result as { structuredContent?: unknown } | undefined;
          toolResults.push({
            toolUseId: block.tool_use_id,
            isError: Boolean(block.is_error),
            content: block.content,
            parsedOutcome: nativeOutcome(block.content),
            structuredContent: metadata?.structuredContent ?? null,
          });
        }
      if (message.type === 'result') {
        sessionId = message.session_id;
        success = message.subtype === 'success' && !message.is_error;
        resultStatus = message.subtype;
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
  }
  const parsedOutput = outcomeSchema.safeParse(rawOutput);
  const output = parsedOutput.success ? parsedOutput.data : null;
  const auditText = await readFile(auditFile, 'utf8').catch((failure: NodeJS.ErrnoException) => {
    if (failure.code === 'ENOENT') return '';
    throw failure;
  });
  const executions = auditText.trim()
    ? auditText
        .trim()
        .split('\n')
        .map(
          (line) =>
            JSON.parse(line) as {
              input: { slug: string };
              outcome: z.infer<typeof outcomeSchema>;
              processId: number;
            },
        )
    : [];
  const execution = executions[0];
  const handlerInputMatches =
    executions.length === 1 && isDeepStrictEqual(execution.input, expectedToolInput);
  const separateProcessObserved = Boolean(
    execution &&
    execution.processId !== process.pid &&
    execution.outcome.processId === execution.processId,
  );
  const nativeResultMatches = Boolean(
    execution &&
    toolResults.some(
      (result) =>
        isDeepStrictEqual(result.parsedOutcome, execution.outcome) &&
        result.isError === !execution.outcome.ok,
    ),
  );
  const finalResultMatches = Boolean(
    execution && output && isDeepStrictEqual(output, execution.outcome),
  );
  const connectedServer = nativeServerStatus.find((server) => server.name === 'catalog');
  const unintendedAuditPresent = await access(prepared.unintendedAudit).then(
    () => true,
    (failure: NodeJS.ErrnoException) => {
      if (failure.code === 'ENOENT') return false;
      throw failure;
    },
  );
  const unintendedStatus = nativeServerStatus.find((server) => server.name === 'unintended');
  const unintendedDiscovered = initialTools.includes('mcp__unintended__get_lesson');
  const connectionChecks = {
    explicitFileLoaded: /^[a-f0-9]{64}$/.test(prepared.loaded.sha256),
    mainServerConnected: connectedServer?.status === 'connected',
    expectedToolDiscovered: initialTools.includes(toolName),
    separateProcessObserved,
    nativeResultMatchesAudit: nativeResultMatches,
    expectedConfigurationScope: strictEnabled
      ? !unintendedStatus && !unintendedDiscovered
      : unintendedStatus?.status === 'connected' && unintendedDiscovered,
    unintendedServerNeverInvoked: !unintendedAuditPresent,
  };
  const connectionVerified = Object.values(connectionChecks).every(Boolean);
  const secret = process.env.ANTHROPIC_API_KEY;
  if (secret) {
    error = error.replaceAll(secret, '[REDACTED]');
    resultErrors = resultErrors.map((message) => message.replaceAll(secret, '[REDACTED]'));
  }
  const verified =
    !error && success && handlerInputMatches && finalResultMatches && connectionVerified;
  return {
    requestedInput,
    stage: 'sdk-invocation',
    sdkStarted: true,
    strictEnabled,
    configFile: prepared.configFile,
    configSha256: prepared.loaded.sha256,
    explicitServerNames: Object.keys(prepared.loaded.mcpServers),
    explicitConfiguration: prepared.loaded.mcpServers,
    unintendedDiscovered,
    unintendedAuditPresent,
    expectedToolInput,
    connection: { type: server.type, command: server.command, script: server.args[0] },
    nativeServerStatus,
    connectionChecks,
    connectionVerified,
    assistantText,
    workspace,
    toolName,
    executions,
    hostProcessId: process.pid,
    calls,
    toolResults,
    hookResults,
    initialTools,
    rawOutput: rawOutput ?? null,
    output,
    checks: {
      handlerInputMatches,
      separateProcessObserved,
      nativeResultMatches,
      finalResultMatches,
    },
    success,
    resultStatus,
    resultErrors,
    error,
    sessionId,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
