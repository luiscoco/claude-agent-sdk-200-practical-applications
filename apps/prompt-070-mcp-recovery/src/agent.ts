import path from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  outputSchema,
  advertisedTool,
  decodedBody,
  auditEvents,
  persistedOutputProof,
} from './recovery.js';
import { publicReport } from './privacy.js';

type Phase = 'diagnosis' | 'recovery';
type PhaseResult = {
  phase: Phase;
  success: boolean;
  sessionId: string;
  status: string;
  output: unknown;
  error: string;
  nativeStatus: Awaited<ReturnType<Query['mcpServerStatus']>>;
};

export async function runRecovery(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/recovery-'));
  const stateFile = path.join(workspace, 'state.json'),
    auditFile = path.join(workspace, 'audit.jsonl');
  const initialState = {
    available: requestedInput.mode !== 'unavailable',
    disconnect: requestedInput.mode === 'disconnected',
  };
  await writeFile(stateFile, JSON.stringify(initialState));
  const toolName = 'mcp__service__get_items';
  const initialCount = requestedInput.mode === 'oversized' ? 400 : requestedInput.pageSize;
  let activePhase: Phase = 'diagnosis',
    closing = false,
    promptsSubmitted = 0;
  let releaseFirst: () => void = () => {},
    releaseRecovery: () => void = () => {},
    releaseInput: () => void = () => {};
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const recoveryGate = new Promise<void>((resolve) => {
    releaseRecovery = resolve;
  });
  const inputGate = new Promise<void>((resolve) => {
    releaseInput = resolve;
  });
  function message(content: string): SDKUserMessage {
    return {
      type: 'user',
      session_id: '',
      parent_tool_use_id: null,
      message: { role: 'user', content },
    };
  }
  async function* input() {
    await firstGate;
    if (closing) return;
    if (requestedInput.mode !== 'unavailable') {
      promptsSubmitted++;
      yield message(
        `Call ${toolName} exactly once with {"count":${initialCount}}. Report the actual failed or persisted-to-file outcome as phase diagnosed, ok false, count null and empty ids. Treat a saved-output notice as a diagnostic. Do not read or summarize the saved file, retry, or call another tool.`,
      );
    }
    await recoveryGate;
    if (closing) return;
    promptsSubmitted++;
    yield message(
      `Recovery is ready. Call ${toolName} exactly once with {"count":${requestedInput.pageSize}}. Return phase recovered and ok true, copying the actual result count and the exact row ids from this new bounded response. Do not retry or call another tool.`,
    );
    await inputGate;
  }
  let finishFirst: (result: PhaseResult | null) => void = () => {},
    finishRecovery: (result: PhaseResult | null) => void = () => {};
  const firstResult = new Promise<PhaseResult | null>((resolve) => {
    finishFirst = resolve;
  });
  const recoveryResult = new Promise<PhaseResult | null>((resolve) => {
    finishRecovery = resolve;
  });
  const calls: Array<{ id: string; name: string; input: unknown; phase: Phase }> = [];
  const decisions: Array<{ id: string; allowed: boolean; phase: Phase }> = [];
  const results: Array<{ id: string; isError: boolean; content: unknown; phase: Phase }> = [];
  const phaseResults: PhaseResult[] = [];
  const admitted = new Set<Phase>();
  let before: Awaited<ReturnType<Query['mcpServerStatus']>> = [],
    afterReconnect: typeof before = [];
  let diagnosis: Record<string, unknown> | null = null,
    fileProof: Awaited<ReturnType<typeof persistedOutputProof>> | null = null;
  let error = '',
    readerError = '',
    reconnectPerformed = false;
  let run: Query | undefined;
  let reader: Promise<void> = Promise.resolve();
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 240000);
  async function connectedStatus(expectTool: boolean) {
    if (!run) throw new Error('Native SDK query is unavailable.');
    const started = Date.now();
    let statuses: typeof before = [];
    do {
      statuses = await run.mcpServerStatus();
      if (
        statuses.some((server) => server.name === 'service' && server.status === 'connected') &&
        advertisedTool(statuses) === expectTool
      )
        return statuses;
      await delay(250);
    } while (Date.now() - started < 60000);
    throw new Error('Native MCP discovery did not reach the expected classroom state.');
  }
  try {
    run = query({
      prompt: input(),
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {
          service: {
            type: 'stdio',
            command: process.execPath,
            args: [path.join(root, 'src/mcp-server.mjs'), stateFile, auditFile],
            alwaysLoad: true,
          },
        },
        allowedTools: [toolName],
        settingSources: [],
        strictMcpConfig: true,
        persistSession: false,
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
          MAX_MCP_OUTPUT_TOKENS: '2000',
          ENABLE_TOOL_SEARCH: 'false',
          MCP_TIMEOUT: '60000',
          MCP_CONNECTION_NONBLOCKING: '0',
          MCP_CONNECT_TIMEOUT_MS: '60000',
          CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
        },
        maxTurns: 12,
        maxBudgetUsd: 1.2,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'mcp__service__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const count =
                    activePhase === 'diagnosis' ? initialCount : requestedInput.pageSize;
                  const allowed =
                    input.tool_name === toolName &&
                    !admitted.has(activePhase) &&
                    isDeepStrictEqual(input.tool_input, { count });
                  decisions.push({ id: input.tool_use_id, allowed, phase: activePhase });
                  if (allowed) admitted.add(activePhase);
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
        },
      },
    });
    reader = (async () => {
      try {
        for await (const message of run!) {
          if (message.type === 'assistant')
            for (const block of message.message.content)
              if (block.type === 'tool_use')
                calls.push({
                  id: block.id,
                  name: block.name,
                  input: block.input,
                  phase: activePhase,
                });
          if (message.type === 'user' && Array.isArray(message.message.content))
            for (const block of message.message.content) {
              if (
                block.type === 'tool_result' &&
                calls.some((call) => call.id === block.tool_use_id && call.name === toolName)
              )
                results.push({
                  id: block.tool_use_id,
                  isError: Boolean(block.is_error),
                  content: block.content,
                  phase: activePhase,
                });
            }
          if (message.type === 'result') {
            const result: PhaseResult = {
              phase: activePhase,
              success: message.subtype === 'success' && !message.is_error,
              sessionId: message.session_id,
              status: message.subtype,
              output: message.subtype === 'success' ? message.structured_output : null,
              error:
                message.subtype === 'success'
                  ? message.is_error
                    ? message.result
                    : ''
                  : message.errors.join('\n'),
              nativeStatus: await run!.mcpServerStatus(),
            };
            phaseResults.push(result);
            if (activePhase === 'diagnosis') finishFirst(result);
            else finishRecovery(result);
          }
        }
      } catch (failure) {
        if (!closing) readerError = failure instanceof Error ? failure.message : String(failure);
        finishFirst(null);
        finishRecovery(null);
      }
    })();
    before = await connectedStatus(initialState.available);
    if (requestedInput.mode === 'unavailable') {
      diagnosis = {
        code: 'TOOL_UNAVAILABLE',
        message: 'Native discovery connected the server and advertised no get_items tool.',
        recoveryAction:
          'Restore the classroom tool, reconnect the server and inspect the new advertisement.',
        modelPromptsAtDiagnosis: promptsSubmitted,
      };
      releaseFirst();
    } else {
      releaseFirst();
      const first = await firstResult;
      if (!first?.success)
        throw new Error(first?.error || readerError || 'The diagnostic model phase failed.');
      const native = results.find(
        (result) =>
          result.phase === 'diagnosis' &&
          decisions.some((decision) => decision.id === result.id && decision.allowed),
      );
      const events = await auditEvents(auditFile);
      if (requestedInput.mode === 'disconnected') {
        if (
          !native?.isError ||
          !/connection closed/i.test(JSON.stringify(native.content)) ||
          !events.some((event) => event.event === 'intentional-disconnect')
        )
          throw new Error('The expected actual MCP disconnect was not observed.');
        diagnosis = {
          code: 'MCP_DISCONNECTED',
          message:
            'The actual tool call returned Connection closed and the owned server audit recorded its exit.',
          recoveryAction: 'Reconnect the owned MCP server and verify a new bounded tool result.',
          lastReportedNativeStatus: first.nativeStatus,
        };
      } else {
        if (
          !native ||
          !/exceeds maximum allowed tokens.*Output has been saved/is.test(
            JSON.stringify(native.content),
          )
        )
          throw new Error('The expected native persisted-output notice was not observed.');
        const handler = events.find((event) => event.event === 'handler-result');
        fileProof = await persistedOutputProof(workspace, String(handler?.value.sha256 || ''));
        if (
          !fileProof.handlerHashMatches ||
          fileProof.count !== 400 ||
          fileProof.actualRows !== 400
        )
          throw new Error('The native persisted output did not match the actual handler payload.');
        diagnosis = {
          code: 'RESULT_PERSISTED',
          message:
            'The actual native reply saved the oversized result to an owned file under the configured 2,000-token classroom budget.',
          recoveryAction: 'Request the bounded page size and verify its direct native result.',
          nativeNoticeMarkedError: native.isError,
          persistedOutput: fileProof,
        };
      }
    }
    if (requestedInput.mode !== 'oversized') {
      await writeFile(stateFile, JSON.stringify({ available: true, disconnect: false }));
      await run.reconnectMcpServer('service');
      reconnectPerformed = true;
    }
    afterReconnect = await connectedStatus(true);
    activePhase = 'recovery';
    releaseRecovery();
    const recovered = await recoveryResult;
    if (!recovered?.success)
      throw new Error(recovered?.error || readerError || 'The recovery model phase failed.');
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    closing = true;
    run?.close();
    releaseFirst();
    releaseRecovery();
    releaseInput();
    await reader;
  }
  const events = await auditEvents(auditFile);
  const boots = events.filter((event) => event.event === 'boot');
  const recoveredNative = results.find(
    (result) =>
      result.phase === 'recovery' &&
      decisions.some((decision) => decision.allowed && decision.id === result.id),
  );
  const nativeBody = decodedBody(recoveredNative?.content);
  const parsed = outputSchema.safeParse(
      phaseResults.find((result) => result.phase === 'recovery')?.output,
    ),
    output = parsed.success ? parsed.data : null;
  const resultEvent = events.filter((event) => event.event === 'handler-result').at(-1);
  const expectedOutput = {
    phase: 'recovered',
    ok: true,
    count: requestedInput.pageSize,
    ids: Array.from({ length: requestedInput.pageSize }, (_, index) => index + 1),
  };
  const checks = {
    actualDiagnosticRecorded: Boolean(diagnosis),
    diagnosticModelMatches:
      requestedInput.mode === 'unavailable' ||
      isDeepStrictEqual(
        outputSchema.safeParse(phaseResults.find((result) => result.phase === 'diagnosis')?.output)
          .data,
        { phase: 'diagnosed', ok: false, count: null, ids: [] },
      ),
    unavailableDiagnosedBeforeModel:
      requestedInput.mode !== 'unavailable' || diagnosis?.modelPromptsAtDiagnosis === 0,
    expectedRecoveryMethod: reconnectPerformed === (requestedInput.mode !== 'oversized'),
    freshServerAfterReconnect:
      requestedInput.mode === 'oversized'
        ? boots.length === 1
        : boots.length === 2 && boots[0].processId !== boots[1].processId,
    nativeToolAdvertisedAfterRecovery: advertisedTool(afterReconnect),
    actualBoundedHandlerResult: Boolean(
      resultEvent?.value.count === requestedInput.pageSize &&
      nativeBody?.count === requestedInput.pageSize &&
      isDeepStrictEqual(
        nativeBody.rows,
        resultEvent.value.firstRows.slice(0, requestedInput.pageSize),
      ),
    ),
    nativeRecoveredResultAccepted: Boolean(recoveredNative && !recoveredNative.isError),
    blockedAttemptsReturnedErrors: decisions
      .filter((decision) => !decision.allowed)
      .every((decision) => results.some((result) => result.id === decision.id && result.isError)),
    finalMatches: isDeepStrictEqual(output, expectedOutput),
    sameLiveSession:
      phaseResults.length > 0 &&
      phaseResults.every((result) => result.sessionId === phaseResults[0].sessionId),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      configuredOutputTokenBudget: 2000,
      before,
      afterReconnect,
      diagnosis,
      fileProof,
      reconnectPerformed,
      promptsSubmitted,
      calls,
      decisions,
      results,
      phaseResults,
      events,
      output,
      checks,
      error: error || readerError,
      verified: !error && !readerError && Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
