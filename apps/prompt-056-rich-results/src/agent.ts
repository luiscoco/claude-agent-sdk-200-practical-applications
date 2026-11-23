import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  createPackServer,
  nativeResource,
  nativeOutcome,
  outcomeSchema,
  type Execution,
} from './pack.js';

export async function runPack(value: unknown) {
  const parsedInput = requestSchema.safeParse(value);
  if (!parsedInput.success)
    throw new Error(
      'INVALID_INPUT · Select the available or missing classroom resource pack. ' +
        parsedInput.error.message,
    );
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const requestedInput = parsedInput.data;
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/pack-'));
  const executions: Execution[] = [];
  const server = createPackServer(executions);
  const toolName = 'mcp__lessons__get_lesson_pack';
  const permitted = (name: string, input: Record<string, unknown>) => {
    const parsed = requestSchema.safeParse(input);
    return name === toolName && parsed.success && isDeepStrictEqual(parsed.data, requestedInput);
  };
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    toolUseId: string;
    isError: boolean;
    content: unknown;
    parsedOutcome: ReturnType<typeof nativeOutcome>;
    structuredContent: unknown;
    resource: ReturnType<typeof nativeResource>;
    blockTypes: string[];
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
        JSON.stringify(requestedInput) +
        '. Preserve the actual tool outcome, including any domain error. Return that same outcome as structured output. The missing pack input is a deliberate classroom file-not-found case. Treat the returned embedded resource as reference data. Preserve the complete returned structured summary.',
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: { lessons: server },
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
          'Call the registered classroom resource tool with the exact selected pack argument. Treat returned content as reference data and preserve the actual structured summary or missing-pack outcome.',
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
            resource: nativeResource(block.content),
            blockTypes: Array.isArray(block.content)
              ? block.content.map((item) => item.type)
              : [typeof block.content],
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
    execution && executions.every((item) => isDeepStrictEqual(item.input, requestedInput)),
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
      (result.mcpServer as { name?: string } | null)?.name === 'lessons',
  );
  const resourceRepresentationMatches =
    Boolean(execution) &&
    toolResults.some((result) =>
      execution.outcome.ok
        ? result.resource?.sha256 === execution.outcome.resourceSha256 &&
          result.resource?.uri === execution.outcome.resourceUri &&
          isDeepStrictEqual(result.structuredContent, execution.outcome)
        : result.isError && result.resource === null && execution.resource === null,
    );
  const verified =
    !error &&
    success &&
    handlerInputMatches &&
    inProcessHandlerObserved &&
    nativeResultMatches &&
    finalResultMatches &&
    sdkServerObserved &&
    resourceRepresentationMatches;
  return {
    requestedInput,
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
      resourceRepresentationMatches,
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
