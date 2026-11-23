import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, tool, createSdkMcpServer, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, waitForCallback } from './reliability.js';
import { publicReport } from './privacy.js';

export async function runReliability(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/reliability-')),
    file = path.join(workspace, 'owned-note.txt');
  const expectedInput = { topic: requestedInput.topic },
    expectedText = `Owned ${requestedInput.topic} reliability note.`;
  const start = performance.now(),
    elapsed = () => Math.round(performance.now() - start);
  const events: Array<Record<string, any>> = [],
    calls: Array<{ id: string; input: unknown }> = [],
    results: Array<{ id: string; isError: boolean; content: unknown }> = [],
    warnings: unknown[] = [],
    executions: unknown[] = [];
  let audit: Promise<void> | undefined, admittedId: string | undefined;
  const readOwned = async () => {
    try {
      return await readFile(file, 'utf8');
    } catch (failure) {
      if ((failure as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw failure;
    }
  };
  const configuration = {
    matcher:
      requestedInput.mode === 'matcher-miss' ? 'mcp__classroom__other' : 'mcp__classroom__save',
    timeoutSeconds: requestedInput.mode === 'timeout-closed' ? 1 : 10,
    onFailure: ['throw-closed', 'timeout-closed'].includes(requestedInput.mode)
      ? ('block' as const)
      : ('continue' as const),
    asyncAudit: requestedInput.mode === 'async-audit',
  };
  const server = createSdkMcpServer({
    name: 'classroom',
    version: '1.0.0',
    alwaysLoad: true,
    tools: [
      tool(
        'save',
        'Save one owned synthetic classroom note.',
        { topic: z.enum(['MCP', 'Hooks']) },
        async (input) => {
          if (executions.length || !isDeepStrictEqual(input, expectedInput))
            throw new Error('Unexpected additional classroom save.');
          executions.push(input);
          await writeFile(file, expectedText);
          events.push({ type: 'handler-saved', elapsedMs: elapsed() });
          return { content: [{ type: 'text' as const, text: 'SAVED' }] };
        },
      ),
    ],
  });
  const callback: HookCallback = async (input, _id, { signal }) => {
    if (input.hook_event_name !== 'PreToolUse') return {};
    events.push({ type: 'hook-enter', id: input.tool_use_id, elapsedMs: elapsed() });
    if (
      !isDeepStrictEqual(input.tool_input, expectedInput) ||
      (admittedId && admittedId !== input.tool_use_id)
    )
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Unexpected classroom save request.',
        },
      };
    admittedId = input.tool_use_id;
    if (requestedInput.mode.startsWith('throw-'))
      throw new Error('CLASSROOM_AUDIT_FAILED · Deliberate owned callback failure.');
    if (requestedInput.mode === 'timeout-closed') {
      await waitForCallback(signal, 2500, () =>
        events.push({ type: 'hook-deadline-cancelled', elapsedMs: elapsed() }),
      );
      return {};
    }
    if (requestedInput.mode === 'async-audit') {
      audit ??= new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          readOwned().then((text) => {
            events.push({
              type: 'background-audit',
              advisory: 'Would deny this owned classroom operation.',
              returnedNativePermissionDecision: false,
              fileAlreadyExists: text !== null,
              elapsedMs: elapsed(),
            });
            resolve();
          }, reject);
        }, 1800),
      );
      events.push({ type: 'async-return', elapsedMs: elapsed() });
      return { async: true, asyncTimeout: 10000 };
    }
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'CLASSROOM_SYNC_DENIED · Synchronous classroom guard.',
      },
    };
  };
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 180000);
  let success = false,
    resultText = '',
    resultStatus = '',
    sessionId = '',
    error = '';
  const run = query({
    prompt: `Call mcp__classroom__save exactly once with topic ${requestedInput.topic}. If it actually succeeds answer only SAVED; after an actual native error answer only BLOCKED. Never retry or use another tool.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: [],
      mcpServers: { classroom: server },
      allowedTools: ['mcp__classroom__*'],
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      permissionMode: 'default',
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
        MCP_CONNECTION_NONBLOCKING: '0',
        CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
      },
      maxTurns: 5,
      maxBudgetUsd: 0.65,
      abortController: controller,
      hooks: {
        PreToolUse: [
          {
            matcher: configuration.matcher,
            timeout: configuration.timeoutSeconds,
            onFailure: configuration.onFailure,
            hooks: [callback],
          },
        ],
      },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use' && block.name === 'mcp__classroom__save')
            calls.push({ id: block.id, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content)
          if (block.type === 'tool_result' && calls.some((call) => call.id === block.tool_use_id))
            results.push({
              id: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
      if (message.type === 'system' && message.subtype === 'informational')
        warnings.push(structuredClone(message));
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        sessionId = message.session_id;
        resultStatus = message.subtype;
        if (message.subtype === 'success') resultText = message.result;
        else error = message.errors.join('\n');
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run.close();
  }
  await audit;
  const actualText = await readOwned(),
    blocked = ['deny', 'throw-closed', 'timeout-closed'].includes(requestedInput.mode);
  const hookEntries = events.filter((event) => event.type === 'hook-enter');
  const asyncReturn = events.find((event) => event.type === 'async-return'),
    handlerSaved = events.find((event) => event.type === 'handler-saved'),
    backgroundAudit = events.find((event) => event.type === 'background-audit');
  const checks = {
    oneActualNativeSave:
      calls.length === 1 &&
      results.length === 1 &&
      isDeepStrictEqual(calls[0].input, expectedInput),
    actualMatcherCallbackCountMatches:
      hookEntries.length === (requestedInput.mode === 'matcher-miss' ? 0 : 1),
    hookIdentifierMatchesNativeCall: hookEntries.every((event) => event.id === calls[0]?.id),
    actualHandlerExecutionMatches: executions.length === (blocked ? 0 : 1),
    actualFilePresenceAndContentsMatch: actualText === (blocked ? null : expectedText),
    actualNativeResultMatches: results.length === 1 && results[0].isError === blocked,
    callbackFailureWarningMatches: requestedInput.mode.startsWith('throw-')
      ? warnings.some((warning) => (warning as { tag?: string }).tag === 'hook_callback_failed')
      : true,
    nativeDeadlineCancellationObserved:
      requestedInput.mode === 'timeout-closed'
        ? events.some((event) => event.type === 'hook-deadline-cancelled')
        : true,
    asyncAuditObservedAfterExecution:
      requestedInput.mode === 'async-audit'
        ? Boolean(
            asyncReturn &&
            handlerSaved &&
            backgroundAudit &&
            asyncReturn.elapsedMs <= handlerSaved.elapsedMs &&
            handlerSaved.elapsedMs < backgroundAudit.elapsedMs &&
            backgroundAudit.fileAlreadyExists &&
            !backgroundAudit.returnedNativePermissionDecision,
          )
        : true,
    exactFinalMatchesNativeOutcome: resultText === (blocked ? 'BLOCKED' : 'SAVED'),
    noAutomaticRetries: calls.length === 1 && executions.length <= 1,
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      configuration,
      events,
      calls,
      results,
      warnings,
      executions,
      fileEvidence: { file: 'owned-note.txt', actualText, exists: actualText !== null },
      output: {
        nativeOutcome: resultText,
        handlerExecutions: executions.length,
        fileExists: actualText !== null,
        backgroundAudit: backgroundAudit ?? null,
      },
      fixtureDisclosure:
        'All saves affect only a fresh owned synthetic classroom note. Async audit output is advisory host evidence, not a late native permission decision.',
      checks,
      success,
      resultStatus,
      sessionId,
      error,
      verified: !error && success && Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
