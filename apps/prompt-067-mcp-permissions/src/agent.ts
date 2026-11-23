import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  permissionRules,
  readTool,
  listTool,
  outputSchema,
  decodedNative,
} from './permissions.js';
import { publicReport } from './privacy.js';

export async function runPermissions(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  const catalogFile = path.join(root, 'fixtures/catalog.json');
  const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/permissions-'));
  const auditFile = path.join(workspace, 'audit.jsonl');
  const allowedTools = permissionRules(requestedInput.mode);
  const expectedInputs: Record<string, unknown> = {
    [readTool]: { slug: requestedInput.slug },
    [listTool]: {},
  };
  const observedRequests: Array<{ id: string; name: string; input: unknown; valid: boolean }> = [];
  const permissionRequests: Array<{
    id: string;
    name: string;
    input: unknown;
    decision: string;
    reason: string;
  }> = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; name: string; isError: boolean; content: unknown }> = [];
  const seen = new Set<string>();
  let run: Query | undefined;
  let nativeServerStatus: Awaited<ReturnType<Query['mcpServerStatus']>> = [];
  let initialTools: string[] = [];
  let rawOutput: unknown;
  let sessionId = '',
    resultStatus = '',
    error = '';
  let success = false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);
  try {
    run = query({
      prompt: `Try ${readTool} exactly once with ${JSON.stringify(expectedInputs[readTool])}, then try ${listTool} exactly once with {} even if the first call was denied. These are synthetic read-only classroom tools. Do not retry or use another tool. For an actual successful read, return readStatus completed and the exact lesson title, otherwise permission-denied and null. For an actual successful list, return listStatus completed and the exact returned slugs, otherwise permission-denied and an empty slugs array.`,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {
          catalog: {
            type: 'stdio',
            command: process.execPath,
            args: [path.join(root, 'src/mcp-server.mjs'), catalogFile, auditFile],
            alwaysLoad: true,
          },
        },
        allowedTools,
        permissionMode: 'default',
        settingSources: [],
        strictMcpConfig: true,
        persistSession: false,
        env: {
          ...process.env,
          MCP_TIMEOUT: '60000',
          MCP_CONNECTION_NONBLOCKING: '0',
          MCP_CONNECT_TIMEOUT_MS: '60000',
          CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
        },
        maxTurns: 7,
        maxBudgetUsd: 0.9,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
        },
        canUseTool: async (name, input, options) => {
          const reason = 'UNAPPROVED_TOOL · This classroom rule did not pre-approve ' + name;
          permissionRequests.push({ id: options.toolUseID, name, input, decision: 'deny', reason });
          return { behavior: 'deny', message: reason };
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'mcp__catalog__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const valid =
                    Object.hasOwn(expectedInputs, input.tool_name) &&
                    !seen.has(input.tool_name) &&
                    isDeepStrictEqual(input.tool_input, expectedInputs[input.tool_name]);
                  observedRequests.push({
                    id: input.tool_use_id,
                    name: input.tool_name,
                    input: input.tool_input,
                    valid,
                  });
                  if (valid) {
                    seen.add(input.tool_name);
                    return {};
                  }
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: 'deny',
                      permissionDecisionReason:
                        'Unexpected arguments or extra classroom tool attempt.',
                    },
                  };
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
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = calls.find(
            (call) => call.id === block.tool_use_id && Object.hasOwn(expectedInputs, call.name),
          );
          if (call)
            results.push({
              id: call.id,
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
            });
        }
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        sessionId = message.session_id;
        resultStatus = message.subtype;
        if (message.subtype === 'success') rawOutput = message.structured_output;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const text = await readFile(auditFile, 'utf8').catch((failure: NodeJS.ErrnoException) => {
    if (failure.code === 'ENOENT') return '';
    throw failure;
  });
  const executions = text.trim()
    ? text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : [];
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const readAllowed = requestedInput.mode !== 'bad-prefix',
    listAllowed = requestedInput.mode === 'server-wide';
  const expectedDenied = [
    ...(!readAllowed ? [readTool] : []),
    ...(!listAllowed ? [listTool] : []),
  ].sort();
  const expectedOutput = {
    readStatus: readAllowed ? 'completed' : 'permission-denied',
    lessonTitle: readAllowed ? catalog[requestedInput.slug].title : null,
    listStatus: listAllowed ? 'completed' : 'permission-denied',
    slugs: listAllowed ? Object.keys(catalog).sort() : [],
  };
  const validRequests = observedRequests.filter((request) => request.valid);
  const validResults = results.filter((result) =>
    validRequests.some((request) => request.id === result.id),
  );
  const actualExecuted = executions.map((execution) => 'mcp__catalog__' + execution.name).sort();
  const expectedExecuted = [
    ...(readAllowed ? [readTool] : []),
    ...(listAllowed ? [listTool] : []),
  ].sort();
  const checks = {
    nativeServerConnected: nativeServerStatus.some(
      (server) => server.name === 'catalog' && server.status === 'connected',
    ),
    bothToolsAdvertised: [readTool, listTool].every((name) => initialTools.includes(name)),
    bothExactRequestsObserved:
      validRequests.length === 2 &&
      [readTool, listTool].every((name) => validRequests.some((request) => request.name === name)),
    nativePermissionFallthroughMatches: isDeepStrictEqual(
      permissionRequests.map((request) => request.name).sort(),
      expectedDenied,
    ),
    actualHandlerAdmissionMatches: isDeepStrictEqual(actualExecuted, expectedExecuted),
    nativeAllowedResultsMatch: executions.every((execution) =>
      validResults.some(
        (result) =>
          result.name === 'mcp__catalog__' + execution.name &&
          !result.isError &&
          isDeepStrictEqual(decodedNative(result.content), execution.outcome),
      ),
    ),
    nativeDeniedResultsObserved: expectedDenied.every((name) =>
      validResults.some(
        (result) =>
          result.name === name &&
          result.isError &&
          JSON.stringify(result.content).includes('UNAPPROVED_TOOL'),
      ),
    ),
    blockedExtraAttemptsReturnedErrors: observedRequests
      .filter((request) => !request.valid)
      .every((request) => results.some((result) => result.id === request.id && result.isError)),
    finalMatches: isDeepStrictEqual(output, expectedOutput),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      permissionMode: 'default',
      allowedTools,
      nativeServerStatus,
      initialTools,
      observedRequests,
      permissionRequests,
      calls,
      results,
      executions,
      output,
      checks,
      success,
      sessionId,
      resultStatus,
      error,
      verified: !error && success && Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
