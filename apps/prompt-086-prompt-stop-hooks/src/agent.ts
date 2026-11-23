import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { requestSchema, promptAdmission, stopPolicy } from './lifecycle-policy.js';
import { publicReport } from './privacy.js';

export async function runLifecycle(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/lifecycle-'));
  const prompt =
    requestedInput.mode === 'reject-prompt'
      ? 'Unrelated classroom topic: gardening. Answer in one short sentence.'
      : `Course topic: ${requestedInput.topic}. Answer in one short sentence about this Claude Agent SDK topic. ${requestedInput.mode === 'complete' ? 'End with the exact marker LESSON_COMPLETE.' : 'For this first draft do not include any completion marker.'} Do not call tools.`;
  const submissions: Array<{
    sessionId: string;
    prompt: string;
    source: unknown;
    admitted: boolean;
    returned: unknown;
  }> = [];
  const stops: Array<{
    sessionId: string;
    active: boolean;
    lastAssistantMessage: string;
    completionSatisfied: boolean;
    policy: string;
    returned: unknown;
  }> = [];
  const assistantTexts: string[] = [],
    toolCalls: Array<{ id: string; name: string }> = [];
  let success = false,
    resultStatus = '',
    sessionId = '',
    resultText = '',
    error = '';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 120000);
  const run = query({
    prompt,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: [],
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 5,
      maxBudgetUsd: 0.65,
      abortController: controller,
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'UserPromptSubmit') return {};
                const admitted = promptAdmission(input.prompt);
                const returned = admitted
                  ? {}
                  : {
                      decision: 'block' as const,
                      reason:
                        'COURSE_TOPIC_REJECTED · Start with a supported MCP or Hooks classroom topic.',
                    };
                submissions.push({
                  sessionId: input.session_id,
                  prompt: input.prompt,
                  source: input.source ?? null,
                  admitted,
                  returned,
                });
                return returned;
              },
            ],
          },
        ],
        Stop: [
          {
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'Stop') return {};
                const lastAssistantMessage = input.last_assistant_message ?? '';
                const completionSatisfied =
                  requestedInput.mode !== 'guard-limit' &&
                  lastAssistantMessage.trim().endsWith('LESSON_COMPLETE');
                const policy = stopPolicy(input.stop_hook_active, completionSatisfied);
                const returned =
                  policy === 'request-repair'
                    ? {
                        decision: 'block' as const,
                        reason:
                          requestedInput.mode === 'guard-limit'
                            ? 'CLASSROOM_GUARD_TEST · This is a deliberate unsatisfied fixture condition. Repeat one brief topic sentence without adding a completion marker.'
                            : 'COURSE_COMPLETION_REQUIRED · Finish one brief topic sentence ending with the exact marker LESSON_COMPLETE.',
                      }
                    : {};
                stops.push({
                  sessionId: input.session_id,
                  active: input.stop_hook_active,
                  lastAssistantMessage,
                  completionSatisfied,
                  policy,
                  returned,
                });
                return returned;
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
      if (message.type === 'assistant')
        for (const block of message.message.content) {
          if (block.type === 'text') assistantTexts.push(block.text);
          if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name });
        }
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
  const rejected = requestedInput.mode === 'reject-prompt';
  const continuation = ['repair-completion', 'guard-limit'].includes(requestedInput.mode);
  const finalCompletionSatisfied = stops.at(-1)?.completionSatisfied ?? false;
  const outcome = rejected
    ? 'prompt-rejected'
    : finalCompletionSatisfied
      ? 'completed'
      : 'manual-review-required';
  const checks = {
    actualSubmissionObserved: submissions.length === 1 && submissions[0].prompt === prompt,
    actualAdmissionMatches: submissions.length === 1 && submissions[0].admitted === !rejected,
    rejectedPromptNeverReachedAssistant: rejected
      ? assistantTexts.length === 0 && stops.length === 0
      : assistantTexts.length > 0,
    actualStopCountMatches: stops.length === (rejected ? 0 : continuation ? 2 : 1),
    initialStopWasNotRecursive: rejected || stops[0]?.active === false,
    continuationGuardObserved: continuation
      ? stops[1]?.active === true && stops[1]?.policy === 'guard-release'
      : true,
    continuationRequestedOnce:
      stops.filter((stop) => stop.policy === 'request-repair').length === (continuation ? 1 : 0),
    activeStopNeverBlockedAgain: stops
      .filter((stop) => stop.active)
      .every(
        (stop) => stop.policy === 'guard-release' && !('decision' in (stop.returned as object)),
      ),
    completionStateMatches:
      finalCompletionSatisfied === (!rejected && requestedInput.mode !== 'guard-limit'),
    nativeHookSessionsCorrelate: [...submissions, ...stops].every(
      (item) => item.sessionId === sessionId,
    ),
    noNativeToolsUsed: toolCalls.length === 0,
    nativeOutcomeMatches: rejected
      ? resultText.includes('UserPromptSubmit operation blocked by hook:') &&
        resultText.includes('COURSE_TOPIC_REJECTED')
      : success && !error,
  };
  return publicReport(
    {
      requestedInput,
      prompt,
      fixtureDisclosure:
        'The guard-limit case deliberately leaves completion unsatisfied and releases the active stop hook for manual review.',
      submissions,
      stops,
      assistantTexts,
      toolCalls,
      output: { outcome, finalCompletionSatisfied, resultText },
      checks,
      success,
      sessionId,
      resultStatus,
      error: rejected ? '' : error,
      nativeError: error,
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
