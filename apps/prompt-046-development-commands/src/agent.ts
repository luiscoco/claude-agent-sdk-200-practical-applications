import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import {
  approvedCommand,
  capturedFiles,
  allowedBash,
  commandModes,
  type CommandMode,
} from './command.js';

export async function runDevelopmentCommand(selected: unknown) {
  if (!commandModes.includes(selected as CommandMode))
    throw new Error('INVALID_MODE · Select a supplied development command.');
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const mode = selected as CommandMode;
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/command-'));
  const nonce = randomUUID();
  const command = approvedCommand(root, workspace, mode, nonce);
  const timeout = mode === 'timeout' ? 1000 : 10000;
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{ toolUseId: string; isError: boolean; content: unknown }> = [];
  const hookResults: Array<{ event: string; response?: unknown; error?: string }> = [];
  const taskEvents: unknown[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let sessionId = '';
  let answer = '';
  let error = '';
  let sdkSuccess = false;
  let initialTools: string[] = [];
  try {
    run = query({
      prompt: [
        `Run the following exact approved command once with native Bash, timeout ${timeout} milliseconds and run_in_background false.`,
        'Preserve the actual output and failure or timeout outcome. A foreground timeout may auto-background this bounded task. Allow its completion notification to arrive.',
        'Use only this exact command. After any nonzero exit, report the observed error and stop. Respond briefly.',
        command,
      ].join('\n'),
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Bash'],
        settingSources: [],
        mcpServers: {},
        maxTurns: 4,
        maxBudgetUsd: 0.75,
        abortController: controller,
        systemPrompt:
          'Execute the exact approved classroom command and preserve its actual outcome. The supplied failure is deliberate. The slow command has a six-second lifetime.',
        canUseTool: async (name, input) =>
          allowedBash(name, input, command, timeout)
            ? { behavior: 'allow', updatedInput: input }
            : {
                behavior: 'deny',
                message: 'Only the exact supplied command and timeout are approved.',
              },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                async (input) =>
                  input.hook_event_name === 'PreToolUse'
                    ? {
                        hookSpecificOutput: {
                          hookEventName: 'PreToolUse',
                          permissionDecision: allowedBash(
                            input.tool_name,
                            input.tool_input as Record<string, unknown>,
                            command,
                            timeout,
                          )
                            ? 'allow'
                            : 'deny',
                          permissionDecisionReason:
                            'Run the approved classroom command with its selected timeout.',
                        },
                      }
                    : {},
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse')
                    hookResults.push({
                      event: input.hook_event_name,
                      response: input.tool_response,
                    });
                  return {};
                },
              ],
            },
          ],
          PostToolUseFailure: [
            {
              matcher: 'Bash',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUseFailure')
                    hookResults.push({ event: input.hook_event_name, error: input.error });
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
      if (
        message.type === 'system' &&
        ['task_started', 'task_updated', 'task_notification', 'background_tasks_changed'].includes(
          message.subtype,
        )
      )
        taskEvents.push(message);
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content)
          if (block.type === 'tool_result')
            toolResults.push({
              toolUseId: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
      if (message.type === 'result') {
        sessionId = message.session_id;
        sdkSuccess = message.subtype === 'success' && !message.is_error;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const captured = await capturedFiles(workspace, nonce);
  const nativeResponse = hookResults.find((result) => result.event === 'PostToolUse')?.response as
    | { timedOutAfterMs?: number; backgroundTaskId?: string; interrupted?: boolean }
    | undefined;
  const foregroundTimedOut = nativeResponse?.timedOutAfterMs === timeout;
  const completion = taskEvents.find(
    (event: any) =>
      event.subtype === 'task_notification' && event.task_id === nativeResponse?.backgroundTaskId,
  ) as { status: string; summary: string } | undefined;
  const expectedExitCode = mode === 'failure' ? 7 : 0;
  const commandObserved = calls.some((call) =>
    allowedBash(call.name, call.input as Record<string, unknown>, command, timeout),
  );
  const nativeFailure = toolResults.some((result) => result.isError);
  const verified =
    !error &&
    commandObserved &&
    captured.receiptMatches &&
    captured.exitCode === expectedExitCode &&
    captured.stdout?.includes('CHECK_STARTED') === true &&
    captured.stderr?.includes('CHECK_DIAGNOSTIC') === true &&
    (mode === 'failure'
      ? nativeFailure && captured.stderr.includes('CHECK_FAILED')
      : captured.stdout.includes('CHECK_PASSED')) &&
    (mode === 'timeout'
      ? foregroundTimedOut &&
        Boolean(nativeResponse?.backgroundTaskId) &&
        completion?.status === 'completed'
      : !foregroundTimedOut);
  return {
    mode,
    workspace,
    command,
    timeout,
    captured,
    calls,
    toolResults,
    hookResults,
    taskEvents,
    initialTools,
    nativeResponse: nativeResponse ?? null,
    foregroundTimedOut,
    completion: completion ?? null,
    nativeFailure,
    expectedExitCode,
    sdkSuccess,
    answer,
    error,
    sessionId,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
