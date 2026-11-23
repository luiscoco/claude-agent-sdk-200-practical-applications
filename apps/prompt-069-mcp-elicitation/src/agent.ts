import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { ClassroomQuestions } from './questions.js';
import { publicReport } from './privacy.js';

const clarificationSchema = z.object({ choice: z.enum(['MCP', 'Hooks']) }).strict();
const approvalSchema = z.object({ approved: z.boolean() }).strict();
const formatSchema = z.object({ format: z.enum(['brief', 'detailed']) }).strict();
const questionInputSchema = z
  .object({
    questions: z
      .array(
        z
          .object({
            question: z.string(),
            multiSelect: z.literal(false),
            options: z
              .array(z.object({ label: z.enum(['MCP', 'Hooks']) }).passthrough())
              .length(2)
              .refine((options) => new Set(options.map((option) => option.label)).size === 2),
          })
          .passthrough(),
      )
      .length(1),
  })
  .passthrough();
const outputSchema = z
  .object({
    ok: z.boolean(),
    topic: z.enum(['MCP', 'Hooks']),
    format: z.enum(['brief', 'detailed']).nullable(),
    text: z.string().nullable(),
    errorCode: z.enum(['', 'TOOL_DENIED', 'ELICITATION_DECLINED', 'ELICITATION_CANCELLED']),
  })
  .strict();
function decodedNative(content: unknown) {
  const texts =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((block) => block?.type === 'text').map((block) => String(block.text))
        : [];
  for (const text of texts) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return null;
}

export async function runInteraction(questions: ClassroomQuestions, controller: AbortController) {
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/interaction-'));
  const auditFile = path.join(workspace, 'audit.jsonl');
  const toolName = 'mcp__survey__prepare_report';
  let chosenTopic: 'MCP' | 'Hooks' | undefined;
  let toolApproved = false,
    toolRequested = false;
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolRequests: Array<{ id: string; valid: boolean }> = [];
  const results: Array<{
    id: string;
    name: string;
    isError: boolean;
    content: unknown;
    metadata: unknown;
  }> = [];
  const callbackEvents: Array<Record<string, unknown>> = [];
  let nativeServerStatus: Awaited<ReturnType<Query['mcpServerStatus']>> = [];
  let rawOutput: unknown,
    success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  let run: Query | undefined;
  const timer = setTimeout(() => controller.abort(), 360000);
  try {
    run = query({
      prompt: `First call AskUserQuestion once with a single question asking which synthetic classroom topic to use. Set multiSelect false and use exactly the option labels MCP and Hooks. Then try ${toolName} exactly once with the chosen topic. The host handles tool approval and any server form request. Copy the actual server outcome as structured output. If the tool request is denied, return ok false, the chosen topic, null format and text, and TOOL_DENIED. Do not retry or use another tool.`,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['AskUserQuestion'],
        allowedTools: [],
        mcpServers: {
          survey: {
            type: 'stdio',
            command: process.execPath,
            args: [path.join(root, 'src/mcp-server.mjs'), auditFile],
            timeout: 240000,
            alwaysLoad: true,
          },
        },
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
        maxTurns: 9,
        maxBudgetUsd: 1,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
        },
        canUseTool: async (name, input, options) => {
          if (name === 'AskUserQuestion' && !chosenTopic) {
            const parsed = questionInputSchema.parse(input);
            const answer = clarificationSchema.parse(
              await questions.ask(
                'agent-clarification',
                { toolName: name, toolUseId: options.toolUseID, questions: parsed.questions },
                options.signal,
              ),
            );
            chosenTopic = answer.choice;
            const answers = { [parsed.questions[0].question]: chosenTopic };
            callbackEvents.push({
              kind: 'agent-clarification',
              name,
              toolUseId: options.toolUseID,
              answers,
            });
            return { behavior: 'allow', updatedInput: { ...input, answers } };
          }
          if (name === toolName && chosenTopic) {
            const answer = approvalSchema.parse(
              await questions.ask(
                'tool-permission',
                { toolName: name, toolUseId: options.toolUseID, input },
                options.signal,
              ),
            );
            toolApproved = answer.approved;
            callbackEvents.push({
              kind: 'tool-permission',
              name,
              toolUseId: options.toolUseID,
              approved: toolApproved,
            });
            return toolApproved
              ? { behavior: 'allow', updatedInput: input }
              : {
                  behavior: 'deny',
                  message: 'TOOL_DENIED · The classroom operator denied this actual tool call.',
                };
          }
          return { behavior: 'deny', message: 'Unexpected classroom operation.' };
        },
        onElicitation: async (request, options) => {
          if (request.serverName !== 'survey' || (request.mode && request.mode !== 'form'))
            throw new Error('Unsupported classroom elicitation source or mode.');
          const requestedSchema = z
            .object({
              type: z.literal('object'),
              properties: z.object({
                format: z
                  .object({
                    type: z.literal('string'),
                    enum: z.tuple([z.literal('brief'), z.literal('detailed')]),
                  })
                  .passthrough(),
              }),
              required: z.array(z.string()).refine((fields) => fields.includes('format')),
            })
            .passthrough()
            .parse(request.requestedSchema);
          const answer = await questions.ask(
            'mcp-elicitation',
            {
              serverName: request.serverName,
              message: request.message,
              mode: request.mode || 'form',
              requestedSchema,
              requestId: options.requestId,
            },
            options.signal,
          );
          if (!('action' in answer)) throw new Error('Invalid elicitation answer.');
          const response =
            answer.action === 'accept'
              ? {
                  action: 'accept' as const,
                  content: formatSchema.parse({ format: answer.format }),
                }
              : { action: answer.action };
          callbackEvents.push({
            kind: 'mcp-elicitation',
            serverName: request.serverName,
            requestId: options.requestId,
            response,
          });
          return response;
        },
        hooks: {
          PreToolUse: [
            {
              matcher: toolName,
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const valid =
                    Boolean(chosenTopic) &&
                    !toolRequested &&
                    isDeepStrictEqual(input.tool_input, { topic: chosenTopic });
                  toolRequests.push({ id: input.tool_use_id, valid });
                  if (valid) {
                    toolRequested = true;
                    return {};
                  }
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: 'deny',
                      permissionDecisionReason: 'Unexpected topic or extra classroom attempt.',
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
      if (message.type === 'system' && message.subtype === 'init')
        nativeServerStatus = await run.mcpServerStatus();
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = calls.find((call) => call.id === block.tool_use_id);
          if (call && ['AskUserQuestion', toolName].includes(call.name))
            results.push({
              id: call.id,
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
              metadata: message.tool_use_result ?? null,
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
    questions.cancel();
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
  const handlerResult = events.find((event) => event.event === 'handler-result');
  const expected = toolApproved
    ? handlerResult?.value
    : { ok: false, topic: chosenTopic, format: null, text: null, errorCode: 'TOOL_DENIED' };
  const nativeTool = results.find(
    (result) =>
      result.name === toolName &&
      toolRequests.some((request) => request.valid && request.id === result.id),
  );
  const checks = {
    serverConnected: nativeServerStatus.some(
      (server) => server.name === 'survey' && server.status === 'connected',
    ),
    actualAgentClarification:
      callbackEvents.filter((event) => event.kind === 'agent-clarification').length === 1 &&
      calls.some((call) => call.name === 'AskUserQuestion'),
    actualToolApprovalRequest:
      callbackEvents.filter((event) => event.kind === 'tool-permission').length === 1,
    extraMcpAttemptsReturnedErrors: toolRequests
      .filter((request) => !request.valid)
      .every((request) => results.some((result) => result.id === request.id && result.isError)),
    handlerAdmissionMatches:
      events.filter((event) => event.event === 'handler-started').length === (toolApproved ? 1 : 0),
    elicitationCountMatches:
      callbackEvents.filter((event) => event.kind === 'mcp-elicitation').length ===
      (toolApproved ? 1 : 0),
    serverObservedActualAnswer: toolApproved
      ? isDeepStrictEqual(
          events.find((event) => event.event === 'elicitation-response')?.value,
          callbackEvents.find((event) => event.kind === 'mcp-elicitation')?.response,
        )
      : events.length === 0,
    nativeOutcomeMatches: toolApproved
      ? Boolean(
          nativeTool &&
          handlerResult &&
          isDeepStrictEqual(decodedNative(nativeTool.content), handlerResult.value) &&
          nativeTool.isError === !handlerResult.value.ok,
        )
      : Boolean(nativeTool?.isError && JSON.stringify(nativeTool.content).includes('TOOL_DENIED')),
    finalMatches: isDeepStrictEqual(output, expected),
  };
  return publicReport(
    {
      workspace,
      nativeServerStatus,
      chosenTopic,
      toolApproved,
      questions: questions.history,
      callbackEvents,
      calls,
      toolRequests,
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
