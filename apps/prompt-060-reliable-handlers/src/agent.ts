import { randomUUID } from 'node:crypto';
import { startClassroomApi } from './classroom-api.js';
import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  toolInputSchema,
  createReliableServer,
  createOperationControl,
  scenarios,
  type OperationControl,
  nativeOutcome,
  outcomeSchema,
  type Execution,
} from './handler.js';

export async function runReliableHandler(
  value: unknown,
  control: OperationControl = createOperationControl(),
) {
  const parsedInput = requestSchema.safeParse(value);
  if (!parsedInput.success)
    throw new Error(
      'INVALID_INPUT · Select a supported reliability scenario and bounded classroom booking label. ' +
        parsedInput.error.message,
    );
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const requestedInput = parsedInput.data;
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/reliable-'));
  const executions: Execution[] = [];
  control.mode = requestedInput.mode;
  const configuration = scenarios[requestedInput.mode];
  const expectedToolInput = { requestKey: randomUUID(), label: requestedInput.label };
  const api = await startClassroomApi({
    ...configuration,
    onAccepted: () => {
      control.phase = 'waiting';
    },
  });
  const server = createReliableServer(api.url, requestedInput.mode, control, executions);
  let approvedCalls = 0;
  const permissionDecisions: Array<{ toolUseId: string; allowed: boolean }> = [];
  const toolName = 'mcp__bookings__create_booking';
  const permitted = (name: string, input: Record<string, unknown>) => {
    const parsed = toolInputSchema.safeParse(input);
    return name === toolName && parsed.success && isDeepStrictEqual(parsed.data, expectedToolInput);
  };
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
        ' with the exact arguments ' +
        JSON.stringify(expectedToolInput) +
        '. Call sequentially ' +
        configuration.calls +
        ' time(s). Wait for each actual result before the next call. For the retry scenario, observe the first timeout, then reuse the exact same input. Preserve the last actual tool outcome as structured output, including an error if returned.',
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: { bookings: server },
        allowedTools: [toolName],
        settingSources: [],
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
          'Run the exact classroom API experiment through the registered booking tool. Preserve actual timeout, cancellation and idempotent replay results. Return the last actual outcome as structured output.',
        hooks: {
          PreToolUse: [
            {
              matcher: toolName,
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const allowed =
                    approvedCalls < configuration.calls &&
                    permitted(input.tool_name, input.tool_input as Record<string, unknown>);
                  if (allowed) approvedCalls++;
                  permissionDecisions.push({ toolUseId: input.tool_use_id, allowed });
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: allowed ? 'allow' : 'deny',
                      permissionDecisionReason: allowed
                        ? 'Exact planned classroom attempt.'
                        : 'Planned attempts are complete or the arguments differ. Return the last actual tool outcome as structured output.',
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
          if (block.type === 'tool_use')
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
    control.abort.abort(new Error('Classroom query finished.'));
    await server.instance.close();
  }
  control.phase = 'settling';
  let backend: ReturnType<typeof api.snapshot>;
  try {
    await api.waitForIdle();
    backend = api.snapshot();
  } finally {
    await api.close();
    control.phase = 'finished';
  }
  const parsedOutput = outcomeSchema.safeParse(rawOutput);
  const output = parsedOutput.success ? parsedOutput.data : null;
  const execution = executions[0];
  const handlerInputMatches = Boolean(
    execution && executions.every((item) => isDeepStrictEqual(item.input, expectedToolInput)),
  );
  const inProcessHandlerObserved =
    executions.length > 0 && executions.every((item) => item.processId === process.pid);
  const acceptedResults = permissionDecisions
    .filter((decision) => decision.allowed)
    .map((decision) => toolResults.find((result) => result.toolUseId === decision.toolUseId));
  const nativeResultMatches =
    executions.length === acceptedResults.length &&
    executions.every(
      (item, index) =>
        isDeepStrictEqual(acceptedResults[index]?.parsedOutcome, item.outcome) &&
        acceptedResults[index]?.isError === !item.outcome.ok,
    );
  const last = executions.at(-1);
  const finalResultMatches = Boolean(last && output && isDeepStrictEqual(output, last.outcome));
  const sdkServerObserved = hookResults.some(
    (result) =>
      (result.mcpServer as { name?: string; source?: string } | null)?.source === 'sdk' &&
      (result.mcpServer as { name?: string } | null)?.name === 'bookings',
  );
  const scenarioChecks = {
    expectedAttemptCount: executions.length === configuration.calls,
    approvedCallsMatchExecutions: approvedCalls === executions.length,
    blockedCallsReturnedErrors: permissionDecisions
      .filter((decision) => !decision.allowed)
      .every((decision) =>
        toolResults.some(
          (result) =>
            result.toolUseId === decision.toolUseId &&
            result.isError &&
            result.parsedOutcome === null,
        ),
      ),
    oneIdempotentEffect:
      backend.bookings.length <= 1 &&
      backend.bookings.every(
        (booking) =>
          booking.requestKey === expectedToolInput.requestKey &&
          booking.label === expectedToolInput.label,
      ),
    backendSettled: backend.operations.every((operation) => operation.phase !== 'pending'),
    retryAfterCommittedTimeout:
      requestedInput.mode !== 'retry-after-timeout' ||
      (executions[0]?.outcome.errorCode === 'TIMEOUT' &&
        executions[0]?.deadlineExpired &&
        last?.outcome.ok === true &&
        last.outcome.replayed &&
        backend.bookings.length === 1 &&
        backend.receipts[0]?.bookingId === last.outcome.bookingId &&
        backend.receipts[0]?.clientClosedBeforeReply === true),
    scenarioOutcomeMatches:
      requestedInput.mode === 'timeout'
        ? output?.errorCode === 'TIMEOUT'
        : requestedInput.mode === 'cancel' && control.cancelRequested
          ? output?.errorCode === 'CANCELLED'
          : output?.ok === true,
  };
  const reliabilityVerified = Object.values(scenarioChecks).every(Boolean);
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
    reliabilityVerified;
  return {
    requestedInput,
    permissionDecisions,
    expectedToolInput,
    configuration,
    backend,
    scenarioChecks,
    reliabilityVerified,
    cancelRequested: control.cancelRequested,
    controlId: control.id,
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
