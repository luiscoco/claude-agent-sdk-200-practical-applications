import path from 'node:path';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, outputSchema, correlated } from './correlation.js';
import { publicReport } from './privacy.js';

export async function runSubagentHooks(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/subagent-'));
  const helper = requestedInput.mode === 'reader' ? 'note-reader' : 'note-auditor';
  const matcher =
    requestedInput.mode === 'filtered-auditor' ? 'note-reader' : 'note-reader|note-auditor';
  const fixture = path.join(workspace, 'classroom-note.txt'),
    fixtureText = `Synthetic ${requestedInput.topic} ${helper} classroom note.\n`;
  await writeFile(fixture, fixtureText);
  const starts: Array<{ sessionId: string; agentId: string; agentType: string }> = [];
  const stops: Array<{
    sessionId: string;
    agentId: string;
    agentType: string;
    active: boolean;
    lastAssistantMessage: string;
  }> = [];
  const taskStarts: Array<{
    task_id: string;
    tool_use_id?: string;
    subagent_type?: string;
    description: string;
  }> = [];
  const calls: Array<{
    id: string;
    name: string;
    input: unknown;
    parentId: string | null;
    agentId: string | null;
  }> = [];
  const results: Array<{
    id: string;
    isError: boolean;
    content: unknown;
    parentId: string | null;
  }> = [];
  const readHooks: Array<{
    id: string;
    agentId: string | null;
    sessionId: string;
    input: unknown;
    response: unknown;
  }> = [];
  const admission: Array<{ id: string; name: string; agentId: string | null; admitted: boolean }> =
    [];
  let parentId: string | null = null,
    readId: string | null = null,
    rawOutput: unknown;
  let success = false,
    error = '',
    sessionId = '',
    resultStatus = '';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 210000);
  const run = query({
    prompt: `Use Agent exactly once to invoke the registered ${helper} in the foreground. Ask it to Read ${JSON.stringify(fixture)} exactly once and return the exact classroom file text including its trailing newline. The parent must not Read the file itself. Wait for the helper to finish, then report completed with helper ${helper} and only the actual classroom file text, including its trailing newline. The native Agent hand-back wraps the helper report with agentId, usage and framing metadata; none of that metadata belongs in the file text. Exclude it. Do not launch another helper or use other tools.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: ['Agent', 'Read'],
      allowedTools: ['Agent', 'Read'],
      agents: Object.fromEntries(
        ['note-reader', 'note-auditor'].map((name) => [
          name,
          {
            description: `Read the one owned synthetic classroom note as ${name}.`,
            prompt: `You are the ${name} classroom helper. Call Read exactly once on the absolute owned path in the task. Return only its exact text including the trailing newline. Never launch another agent or use other tools.`,
            tools: ['Read'],
            model: 'inherit',
            maxTurns: 3,
          },
        ]),
      ),
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      settings: {
        permissions: {
          blockReadsOutsideWorkingDirectories: true,
          blockWritesOutsideWorkingDirectories: true,
        },
      },
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 7,
      maxBudgetUsd: 1.2,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      hooks: {
        SubagentStart: [
          {
            matcher,
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'SubagentStart')
                  starts.push({
                    sessionId: input.session_id,
                    agentId: input.agent_id,
                    agentType: input.agent_type,
                  });
                return {};
              },
            ],
          },
        ],
        SubagentStop: [
          {
            matcher,
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'SubagentStop')
                  stops.push({
                    sessionId: input.session_id,
                    agentId: input.agent_id,
                    agentType: input.agent_type,
                    active: input.stop_hook_active,
                    lastAssistantMessage: input.last_assistant_message ?? '',
                  });
                return {};
              },
            ],
          },
        ],
        PreToolUse: [
          {
            matcher: 'Agent|Read',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const args = input.tool_input as Record<string, unknown>;
                let admitted = false;
                if (input.tool_name === 'Agent') {
                  admitted =
                    !input.agent_id &&
                    args.subagent_type === helper &&
                    args.run_in_background !== true &&
                    (!parentId || parentId === input.tool_use_id);
                  if (admitted) parentId = input.tool_use_id;
                } else {
                  admitted =
                    Boolean(input.agent_id) &&
                    args.file_path === fixture &&
                    (!readId || readId === input.tool_use_id);
                  if (admitted) readId = input.tool_use_id;
                }
                admission.push({
                  id: input.tool_use_id,
                  name: input.tool_name,
                  agentId: input.agent_id ?? null,
                  admitted,
                });
                return admitted
                  ? {}
                  : {
                      hookSpecificOutput: {
                        hookEventName: 'PreToolUse',
                        permissionDecision: 'deny',
                        permissionDecisionReason:
                          'Only the selected classroom helper and its one owned Read are admitted.',
                      },
                    };
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: 'Read',
            hooks: [
              async (input) => {
                if (input.hook_event_name === 'PostToolUse')
                  readHooks.push({
                    id: input.tool_use_id,
                    agentId: input.agent_id ?? null,
                    sessionId: input.session_id,
                    input: structuredClone(input.tool_input),
                    response: structuredClone(input.tool_response),
                  });
                return {};
              },
            ],
          },
        ],
      },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') sessionId = message.session_id;
      if (message.type === 'system' && message.subtype === 'task_started')
        taskStarts.push({
          task_id: message.task_id,
          tool_use_id: message.tool_use_id,
          subagent_type: message.subagent_type,
          description: message.description,
        });
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use' && ['Agent', 'Read'].includes(block.name))
            calls.push({
              id: block.id,
              name: block.name,
              input: block.input,
              parentId: message.parent_tool_use_id,
              agentId: message.agent_id ?? null,
            });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content)
          if (block.type === 'tool_result' && calls.some((call) => call.id === block.tool_use_id))
            results.push({
              id: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
              parentId: message.parent_tool_use_id,
            });
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        sessionId = message.session_id;
        resultStatus = message.subtype;
        if (message.subtype === 'success') rawOutput = message.structured_output;
        else error = message.errors.join('\n');
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run.close();
  }
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const parentCalls = calls.filter((call) => call.name === 'Agent'),
    childReads = calls.filter((call) => call.name === 'Read');
  const hooksExpected = requestedInput.mode !== 'filtered-auditor';
  const checks = {
    oneActualParentAgent: parentCalls.length === 1 && parentCalls[0].parentId === null,
    selectedHelperActuallyInvoked:
      (parentCalls[0]?.input as Record<string, unknown>)?.subagent_type === helper,
    oneActualTaskStart: taskStarts.length === 1,
    oneActualChildRead: childReads.length === 1 && readHooks.length === 1,
    taskChildAndParentCorrelate: Boolean(
      taskStarts[0] &&
      parentCalls[0] &&
      childReads[0] &&
      correlated(taskStarts[0], parentCalls[0].id, childReads[0]),
    ),
    observedLifecycleCountsMatchMatcher:
      starts.length === (hooksExpected ? 1 : 0) && stops.length === (hooksExpected ? 1 : 0),
    lifecycleIdentifiersMatchTask: [...starts, ...stops].every(
      (item) =>
        item.agentId === taskStarts[0]?.task_id &&
        item.agentType === helper &&
        item.sessionId === sessionId,
    ),
    actualChildReadMatches:
      readHooks.length === 1 &&
      readHooks[0].agentId === taskStarts[0]?.task_id &&
      readHooks[0].id === childReads[0]?.id &&
      (readHooks[0].response as { file?: { content?: string } })?.file?.content === fixtureText,
    actualStopContainsFileText: stops.every((stop) =>
      stop.lastAssistantMessage.includes(fixtureText.trim()),
    ),
    noUnexpectedCallsAdmitted: admission.length >= 2 && admission.every((item) => item.admitted),
    actualNativeToolsSucceeded: results.length === 2 && results.every((result) => !result.isError),
    ownedFixtureUnchanged: (await readFile(fixture, 'utf8')) === fixtureText,
    finalMatchesActualChildRead: isDeepStrictEqual(output, {
      status: 'completed',
      helper,
      text: fixtureText,
    }),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      helper,
      matcher,
      fixtureDisclosure:
        'One real native SDK subagent reads one owned synthetic classroom note; the filtered control still executes the helper but suppresses nonmatching lifecycle observers.',
      starts,
      stops,
      taskStarts,
      calls,
      results,
      readHooks,
      admission,
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
