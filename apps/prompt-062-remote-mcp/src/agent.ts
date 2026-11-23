import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query, type McpServerStatus } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  endpoints,
  requestSchema,
  outputSchema,
  toolName,
  inspectRemote,
  matchesSourceExcerpt,
} from './remote.js';

export async function runRemoteMcp(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  const url = endpoints[requestedInput.mode];
  const preflight = await inspectRemote(url);
  const connection = { type: 'http' as const, url };
  if (!preflight.connected) {
    return {
      requestedInput,
      connection,
      preflight,
      stage: 'connection-preflight',
      sdkStarted: false,
      nativeServerStatus: [],
      initialTools: [],
      calls: [],
      toolResults: [],
      hookResults: [],
      output: null,
      sessionId: '',
      success: false,
      resultStatus: '',
      resultErrors: [],
      error: preflight.error,
      checks: {
        httpFailureObserved: Boolean(preflight.error),
        sdkSkippedAfterConnectionFailure: true,
      },
      verified: requestedInput.mode === 'invalid-route' && Boolean(preflight.error),
      checkedAt: new Date().toISOString(),
    };
  }
  if (!preflight.tools.some((tool) => tool.name === 'search_claude_code_docs'))
    throw new Error('The remote documentation server did not advertise the expected search tool.');
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/remote-'));
  const expectedToolInput = { query: requestedInput.query };
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    toolUseId: string;
    isError: boolean;
    content: unknown;
    sha256: string;
  }> = [];
  const hookResults: Array<{ event: string; mcpServer: unknown }> = [];
  let nativeServerStatus: McpServerStatus[] = [];
  let initialTools: string[] = [];
  let sessionId = '',
    resultStatus = '',
    error = '';
  let success = false;
  let resultErrors: string[] = [];
  let rawOutput: unknown;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);
  let run: Query | undefined;
  try {
    run = query({
      prompt:
        'Call ' +
        toolName +
        ' exactly once with the exact arguments ' +
        JSON.stringify(expectedToolInput) +
        '. Copy one complete, relevant sentence of six to twenty-five words exactly from a returned documentation Content field. Preserve its exact characters. Return the exact tool name, sourceExcerpt and the matching Link URL as sourceUrl. Select a documentation passage that explains this query.',
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        settingSources: [],
        allowedTools: [toolName],
        mcpServers: { docs: { type: 'http', url, alwaysLoad: true } },
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
          schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
        },
        systemPrompt:
          'Use the actual remote documentation search tool. Copy a short verbatim documentation excerpt and its matching source URL from the returned content. Preserve the exact quoted text.',
        hooks: {
          PreToolUse: [
            {
              matcher: 'mcp__docs__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const allowed =
                    input.tool_name === toolName &&
                    isDeepStrictEqual(input.tool_input, expectedToolInput);
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
              matcher: toolName,
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse')
                    hookResults.push({
                      event: input.hook_event_name,
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
      if (message.type === 'system' && message.subtype === 'init') {
        initialTools = message.tools;
        nativeServerStatus = await run.mcpServerStatus();
      }
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content)) {
        for (const block of message.message.content) {
          if (
            block.type !== 'tool_result' ||
            !calls.some((call) => call.id === block.tool_use_id && call.name === toolName)
          )
            continue;
          toolResults.push({
            toolUseId: block.tool_use_id,
            isError: Boolean(block.is_error),
            content: block.content,
            sha256: createHash('sha256').update(JSON.stringify(block.content)).digest('hex'),
          });
        }
        if (toolResults.length) nativeServerStatus = await run.mcpServerStatus();
      }
      if (message.type === 'result') {
        sessionId = message.session_id;
        resultStatus = message.subtype;
        success = message.subtype === 'success' && !message.is_error;
        rawOutput = message.subtype === 'success' ? message.structured_output : null;
        resultErrors = success
          ? []
          : message.subtype === 'success'
            ? [message.result]
            : message.errors;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const parsed = outputSchema.safeParse(rawOutput);
  const output = parsed.success ? parsed.data : null;
  const native = nativeServerStatus.find((server) => server.name === 'docs');
  const searchCalls = calls.filter((call) => call.name === toolName);
  const checks = {
    remotePreflightConnected: preflight.connected,
    nativeServerConnected: native?.status === 'connected',
    remoteServerIdentityMatches: native?.serverInfo?.name === preflight.serverInfo?.name,
    expectedSearchDiscovered:
      initialTools.includes(toolName) ||
      Boolean(native?.tools?.some((tool) => tool.name === 'search_claude_code_docs')),
    exactSearchArguments:
      searchCalls.length === 1 && isDeepStrictEqual(searchCalls[0].input, expectedToolInput),
    successfulNativeResult:
      toolResults.length === 1 &&
      !toolResults[0].isError &&
      JSON.stringify(toolResults[0].content).length > 100,
    finalSchemaValid: parsed.success,
    sourceExcerptMatches:
      toolResults.length === 1 && matchesSourceExcerpt(toolResults[0].content, output),
  };
  const secret = process.env.ANTHROPIC_API_KEY;
  if (secret) {
    error = error.replaceAll(secret, '[REDACTED]');
    resultErrors = resultErrors.map((text) => text.replaceAll(secret, '[REDACTED]'));
  }
  return {
    requestedInput,
    connection,
    preflight,
    stage: 'sdk-invocation',
    sdkStarted: true,
    nativeServerStatus,
    initialTools,
    expectedToolInput,
    calls,
    toolResults,
    hookResults,
    output,
    sessionId,
    success,
    resultStatus,
    resultErrors,
    error,
    checks,
    verified: !error && success && Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
  };
}
