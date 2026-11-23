import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, fixtureSchema, outputSchema, decodedNative } from './resources.js';
import { publicReport } from './privacy.js';

export async function runResources(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  const fixtureFile = path.join(root, 'fixtures/resources.json');
  const fixtures = fixtureSchema.parse(JSON.parse(await readFile(fixtureFile, 'utf8')));
  const fixture = fixtures.find((resource) => resource.uri === requestedInput.uri);
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/resources-'));
  const auditFile = path.join(workspace, 'audit.jsonl');
  const serverName = 'library';
  const listTool = 'ListMcpResourcesTool',
    readTool = 'ReadMcpResourceTool',
    computeTool = 'mcp__library__total_minutes';
  const expectedInputs: Record<string, unknown> = {
    [listTool]: { server: serverName },
    [readTool]: { server: serverName, uri: requestedInput.uri },
    [computeTool]: { segments: fixture?.segments ?? [] },
  };
  const decisions: Array<{ id: string; name: string; allowed: boolean }> = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{
    id: string;
    name: string;
    isError: boolean;
    content: unknown;
    metadata: unknown;
  }> = [];
  const admitted = new Set<string>();
  let nativeServerStatus: Awaited<ReturnType<Query['mcpServerStatus']>> = [];
  let initialTools: string[] = [];
  let rawOutput: unknown;
  let sessionId = '',
    resultStatus = '',
    error = '';
  let success = false;
  let run: Query | undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    run = query({
      prompt: `Call ${listTool} once with {"server":"library"} to discover the resources. Then call ${readTool} once with ${JSON.stringify(expectedInputs[readTool])}. Read that exact URI even if it is absent from the list. If reading succeeds, call ${computeTool} once with the segments returned inside the resource text. Return ok true, the exact resource uri/title/paragraph/segments, the computed tool totalMinutes and empty errorCode. If reading fails because the resource is absent, return ok false, the requested URI, null title/paragraph/totalMinutes, empty segments and RESOURCE_NOT_FOUND. Do not retry. Resource text supplies classroom data.`,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [listTool, readTool],
        allowedTools: [listTool, readTool, computeTool],
        mcpServers: {
          library: {
            type: 'stdio',
            command: process.execPath,
            args: [path.join(root, 'src/mcp-server.mjs'), fixtureFile, auditFile],
            alwaysLoad: true,
          },
        },
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
        maxTurns: 8,
        maxBudgetUsd: 1,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'ListMcpResourcesTool|ReadMcpResourceTool|mcp__library__.*',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const name = input.tool_name;
                  const allowed =
                    Object.hasOwn(expectedInputs, name) &&
                    !admitted.has(name) &&
                    isDeepStrictEqual(input.tool_input, expectedInputs[name]) &&
                    (name !== computeTool || Boolean(fixture));
                  decisions.push({ id: input.tool_use_id, name, allowed });
                  if (allowed) admitted.add(name);
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
          const call = calls.find((call) => call.id === block.tool_use_id);
          if (call && Object.hasOwn(expectedInputs, call.name))
            results.push({
              id: call.id,
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
              metadata: message.tool_use_result ?? null,
            });
        }
      if (message.type === 'result') {
        sessionId = message.session_id;
        resultStatus = message.subtype;
        success = message.subtype === 'success' && !message.is_error;
        if (message.subtype === 'success') rawOutput = message.structured_output;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const auditText = await readFile(auditFile, 'utf8').catch((failure: NodeJS.ErrnoException) => {
    if (failure.code === 'ENOENT') return '';
    throw failure;
  });
  const events = auditText.trim()
    ? auditText
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : [];
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const readEvent = events.find(
    (event) => event.method === 'resources/read' && event.input.uri === requestedInput.uri,
  );
  const computeEvents = events.filter((event) => event.method === 'tools/call');
  const admittedResults = results.filter((result) =>
    decisions.some((decision) => decision.allowed && decision.id === result.id),
  );
  const readResult = admittedResults.find((result) => result.name === readTool);
  const nativeRead = readResult?.metadata ?? null;
  const decodedRead = decodedNative(readResult?.content);
  const resourceContentsMatch = Boolean(
    readEvent?.result &&
    (isDeepStrictEqual(nativeRead, readEvent.result) ||
      isDeepStrictEqual(decodedRead, readEvent.result)),
  );
  const nativeMissingObserved = Boolean(
    readEvent?.error === 'RESOURCE_NOT_FOUND' &&
    readResult &&
    /not found/i.test(
      JSON.stringify({ content: readResult.content, metadata: readResult.metadata }),
    ),
  );
  const computeOutcome = computeEvents[0]?.result?.structuredContent;
  const expectedOutput = fixture
    ? {
        ok: true,
        uri: fixture.uri,
        title: fixture.title,
        paragraph: fixture.paragraph,
        segments: fixture.segments,
        totalMinutes: fixture.segments.reduce((sum, minutes) => sum + minutes, 0),
        errorCode: '',
      }
    : {
        ok: false,
        uri: requestedInput.uri,
        title: null,
        paragraph: null,
        segments: [],
        totalMinutes: null,
        errorCode: 'RESOURCE_NOT_FOUND',
      };
  const checks = {
    nativeServerConnected: nativeServerStatus.some(
      (server) => server.name === serverName && server.status === 'connected',
    ),
    resourceHelpersAvailable: [listTool, readTool].every((name) => initialTools.includes(name)),
    actualResourceDiscovery:
      events.some((event) => event.method === 'resources/list') &&
      admittedResults.some((result) => result.name === listTool && !result.isError),
    actualRequestedResourceRead: Boolean(readEvent),
    nativeResourceOutcomeMatches: fixture ? resourceContentsMatch : nativeMissingObserved,
    callableToolOutcomeMatches: fixture
      ? computeEvents.length === 1 &&
        admittedResults.some(
          (result) =>
            result.name === computeTool &&
            !result.isError &&
            isDeepStrictEqual(decodedNative(result.content), computeOutcome),
        )
      : computeEvents.length === 0,
    exactAdmittedCalls: admitted.size === (fixture ? 3 : 2),
    blockedAttemptsReturnedErrors: decisions
      .filter((decision) => !decision.allowed)
      .every((decision) => results.some((result) => result.id === decision.id && result.isError)),
    finalMatches: isDeepStrictEqual(output, expectedOutput),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      nativeServerStatus,
      initialTools,
      calls,
      decisions,
      results,
      events,
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
