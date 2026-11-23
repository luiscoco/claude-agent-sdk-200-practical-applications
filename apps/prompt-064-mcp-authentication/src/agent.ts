import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { ClassroomOAuth } from './oauth.js';
import { publicReport } from './privacy.js';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  nativeOutcome,
  outcomeSchema,
  toolInputSchema,
  type Execution,
  type HttpEvent,
} from './mcp.js';

export async function runAuthenticated(
  value: unknown,
  accessToken: string | undefined,
  oauth: ClassroomOAuth,
  recordedExecutions: Execution[],
  httpEvents: HttpEvent[],
) {
  const parsedInput = toolInputSchema.safeParse(value);
  if (!parsedInput.success)
    throw new Error('INVALID_INPUT · Enter a bounded classroom lesson slug.');
  const requestedInput = parsedInput.data;
  const root = path.resolve(import.meta.dirname, '..');
  const runId = randomUUID();
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'X-Course-Run': runId,
  };
  if (accessToken) header.Authorization = 'Bearer ' + accessToken;
  const grant = oauth.authenticate(header.Authorization);
  const preflightResponse = await fetch(oauth.audience, {
    method: 'POST',
    headers: header,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'preflight',
      method: 'initialize',
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'course-auth-preflight', version: '1.0.0' },
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const preflightBody: unknown = await preflightResponse.json();
  const preflight = {
    httpStatus: preflightResponse.status,
    challenge: preflightResponse.headers.get('www-authenticate'),
    body: preflightBody,
  };
  if (!preflightResponse.ok) {
    return publicReport(
      {
        requestedInput,
        runId,
        stage: 'authentication-preflight',
        sdkStarted: false,
        preflight,
        connection: {
          type: 'http',
          url: oauth.audience,
          authorizationHeaderConfigured: Boolean(accessToken),
        },
        auth: { credentialSupplied: Boolean(accessToken), admitted: false },
        httpEvents: httpEvents.filter((event) => event.runId === runId),
        executions: [],
        nativeServerStatus: [],
        initialTools: [],
        calls: [],
        toolResults: [],
        hookResults: [],
        output: null,
        sessionId: '',
        resultStatus: '',
        resultErrors: [],
        success: false,
        error: 'AUTHENTICATION_REQUIRED · Complete the classroom OAuth connection.',
        checks: {
          actualUnauthorizedStatus: preflightResponse.status === 401,
          noProtectedToolInvocation: !recordedExecutions.some((item) => item.runId === runId),
        },
        verified: preflightResponse.status === 401,
        checkedAt: new Date().toISOString(),
      },
      [accessToken, process.env.ANTHROPIC_API_KEY],
    );
  }
  if (!grant) throw new Error('The protected endpoint admitted an unknown classroom token.');
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/authenticated-'));
  const expectedToolInput = { slug: requestedInput.slug };
  const server = {
    type: 'http' as const,
    url: oauth.audience,
    headers: { Authorization: 'Bearer ' + accessToken, 'X-Course-Run': runId },
    alwaysLoad: true,
  };
  const toolName = 'mcp__secure_catalog__get_lesson';
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
        '. Preserve the actual authenticated HTTP tool outcome, including its subject and any missing-lesson error. Return that same outcome as structured output.',
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: { secure_catalog: server },
        strictMcpConfig: true,
        allowedTools: [toolName],
        settingSources: [],
        persistSession: false,
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
              matcher: toolName,
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
          nativeServerStatus = await run.mcpServerStatus();
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
  const executions = recordedExecutions.filter((item) => item.runId === runId);
  const execution = executions[0];
  const handlerInputMatches =
    executions.length === 1 && isDeepStrictEqual(execution.input, expectedToolInput);
  const authenticatedHandlerObserved = Boolean(
    execution &&
    execution.tokenReference === grant.reference &&
    execution.outcome.subject === grant.subject,
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
  const connectedServer = nativeServerStatus.find((server) => server.name === 'secure_catalog');
  const connectionChecks = {
    protectedPreflightAccepted: preflight.httpStatus === 200,
    nativeServerConnected: connectedServer?.status === 'connected',
    remoteIdentityMatches: connectedServer?.serverInfo?.name === 'classroom-protected-catalog',
    expectedToolDiscovered:
      initialTools.includes(toolName) ||
      Boolean(connectedServer?.tools?.some((tool) => tool.name === 'get_lesson')),
    authenticatedHandlerObserved,
    nativeResultMatches,
    authenticatedHttpCallObserved: httpEvents.some(
      (event) =>
        event.runId === runId &&
        event.method === 'tools/call' &&
        event.authorized &&
        event.tokenReference === grant.reference,
    ),
  };
  const connectionVerified = Object.values(connectionChecks).every(Boolean);
  const secret = process.env.ANTHROPIC_API_KEY;
  if (secret) {
    error = error.replaceAll(secret, '[REDACTED]');
    resultErrors = resultErrors.map((message) => message.replaceAll(secret, '[REDACTED]'));
  }
  const verified =
    !error && success && handlerInputMatches && finalResultMatches && connectionVerified;
  return publicReport(
    {
      requestedInput,
      runId,
      stage: 'sdk-invocation',
      sdkStarted: true,
      preflight,
      auth: {
        credentialSupplied: true,
        admitted: true,
        subject: grant.subject,
        scope: grant.scope,
        audience: grant.audience,
        reference: grant.reference,
        expiresAt: new Date(grant.expiresAt).toISOString(),
      },
      connection: {
        type: server.type,
        url: server.url,
        authorizationHeaderConfigured: Boolean(server.headers.Authorization),
      },
      httpEvents: httpEvents.filter((event) => event.runId === runId),
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
      output,
      checks: {
        handlerInputMatches,
        authenticatedHandlerObserved,
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
    },
    [accessToken, process.env.ANTHROPIC_API_KEY],
  );
}
