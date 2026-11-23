import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  toolInputSchema,
  createAuthorizationServer,
  principals,
  type AccessEvent,
  nativeOutcome,
  outcomeSchema,
  type Execution,
} from './authorization.js';

export async function runAuthorization(value: unknown) {
  const parsedInput = requestSchema.safeParse(value);
  if (!parsedInput.success)
    throw new Error(
      'INVALID_INPUT · Select a supported classroom identity and project. ' +
        parsedInput.error.message,
    );
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const requestedInput = parsedInput.data;
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/authorization-'));
  const executions: Execution[] = [];
  const principal = principals[requestedInput.actor];
  const expectedToolInput = { projectId: requestedInput.projectId };
  const accesses: AccessEvent[] = [];
  const server = createAuthorizationServer(principal, executions, accesses);
  const toolName = 'mcp__projects__read_project_notes';
  const permitted = (name: string, input: Record<string, unknown>) => {
    const parsed = toolInputSchema.safeParse(input);
    return name === toolName && parsed.success && isDeepStrictEqual(parsed.data, expectedToolInput);
  };
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
  const timer = setTimeout(() => controller.abort(), 90000);
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
        '. Preserve the actual tool outcome, including any domain error. Return that same outcome as structured output. The local classroom handler enforces host-selected identity permissions. Preserve its actual allow or deny outcome and all returned fields.',
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: { projects: server },
        allowedTools: [toolName],
        settingSources: [],
        maxTurns: 5,
        maxBudgetUsd: 0.75,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outcomeSchema, { target: 'draft-7' }),
        },
        systemPrompt:
          'Call the registered project notes tool with the exact selected project ID. Preserve its actual authorization result or error as structured output. The host provides the classroom principal to the handler.',
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
      if (message.type === 'system' && message.subtype === 'init') initialTools = message.tools;
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
    await server.instance.close();
  }
  const parsedOutput = outcomeSchema.safeParse(rawOutput);
  const output = parsedOutput.success ? parsedOutput.data : null;
  const execution = executions[0];
  const handlerInputMatches = Boolean(
    execution && executions.every((item) => isDeepStrictEqual(item.input, expectedToolInput)),
  );
  const inProcessHandlerObserved =
    executions.length > 0 && executions.every((item) => item.processId === process.pid);
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
  const sdkServerObserved = hookResults.some(
    (result) =>
      (result.mcpServer as { name?: string; source?: string } | null)?.source === 'sdk' &&
      (result.mcpServer as { name?: string } | null)?.name === 'projects',
  );
  const denied = execution?.outcome.ok === false;
  const observable = JSON.stringify({
    executions,
    calls,
    toolResults,
    hookResults,
    assistantText,
    output,
  });
  const authorizationChecks = {
    hostPrincipalPreserved:
      Boolean(execution) && execution.actorId === principal.id && execution.role === principal.role,
    identityAbsentFromToolInput: calls
      .filter((call) => call.name === toolName)
      .every((call) => isDeepStrictEqual(call.input, expectedToolInput)),
    dataAccessGuardVerified:
      Boolean(execution) &&
      (denied
        ? accesses.length === 0 && execution.protectedReadsAfter === execution.protectedReadsBefore
        : accesses.length === 1 &&
          execution.protectedReadsAfter === execution.protectedReadsBefore + 1),
    deniedNotesAbsent:
      !denied ||
      (!observable.includes('ALICE_CLASSROOM_NOTE') &&
        !observable.includes('BOB_CLASSROOM_NOTE') &&
        output?.notes === null),
  };
  const authorizationVerified = Object.values(authorizationChecks).every(Boolean);
  const secret = process.env.ANTHROPIC_API_KEY;
  if (secret) {
    error = error.replaceAll(secret, '[REDACTED]');
    resultErrors = resultErrors.map((message) => message.replaceAll(secret, '[REDACTED]'));
  }
  const verified =
    !error &&
    success &&
    handlerInputMatches &&
    inProcessHandlerObserved &&
    nativeResultMatches &&
    finalResultMatches &&
    sdkServerObserved &&
    authorizationVerified;
  return {
    requestedInput,
    principal,
    principalSource: 'local-classroom-identity-selector',
    expectedToolInput,
    accesses,
    authorizationChecks,
    authorizationVerified,
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
      inProcessHandlerObserved,
      nativeResultMatches,
      finalResultMatches,
      sdkServerObserved,
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
