import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  nativeQuestionSchema,
  responseText,
  outputSchema,
} from './clarification.js';
import { ClassroomQuestions } from './questions.js';
import type { Answer } from './questions.js';
import { publicReport } from './privacy.js';

export async function runClarification(
  questions: ClassroomQuestions,
  controller: AbortController,
  value: unknown,
) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/clarification-'));
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; isError: boolean; content: unknown }> = [];
  const observedRequests: Array<{ id: string; input: unknown; valid: boolean }> = [];
  const callbackEvents: Array<{
    id: string;
    originalInput: Record<string, unknown>;
    answer: Answer;
    updatedInput: Record<string, unknown>;
  }> = [];
  let requested = false,
    answered = false;
  let initialTools: string[] = [],
    rawOutput: unknown;
  let success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  const timer = setTimeout(() => controller.abort(), 360000);
  const run = query({
    prompt: `Use AskUserQuestion exactly once to ask what the ${requestedInput.topic} classroom lesson should emphasize. Generate one question with two options labelled Code and Diagrams, with helpful descriptions. Set multiSelect to ${requestedInput.style === 'multiple'}. The application supports selecting options and custom free text. After the actual answer is returned, output the exact original question and exact submitted answer. Do not ask another question or use another tool.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      systemPrompt:
        'This classroom lesson concerns the Claude Agent SDK, its MCP integration and its agent lifecycle hooks. For the final JSON, copy the original native question and submitted answer exactly, retaining punctuation, curly quotes, accents, capitalization and line breaks.',
      tools: ['AskUserQuestion'],
      allowedTools: [],
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 6,
      maxBudgetUsd: 0.7,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      canUseTool: async (name, input, options) => {
        if (name !== 'AskUserQuestion' || answered)
          return { behavior: 'deny', message: 'Unexpected additional classroom question.' };
        const parsed = nativeQuestionSchema.parse(input);
        const answer = await questions.ask(
          'agent-clarification',
          { toolName: name, toolUseId: options.toolUseID, input },
          controller.signal,
        );
        answered = true;
        const response = responseText(answer);
        const answers = { [parsed.questions[0].question]: response };
        const updatedInput = { ...input, questions: input.questions, answers };
        callbackEvents.push({ id: options.toolUseID, originalInput: input, answer, updatedInput });
        return { behavior: 'allow', updatedInput };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'AskUserQuestion',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const parsed = nativeQuestionSchema.safeParse(input.tool_input);
                const valid =
                  !requested &&
                  parsed.success &&
                  parsed.data.questions[0].multiSelect === (requestedInput.style === 'multiple');
                observedRequests.push({ id: input.tool_use_id, valid, input: input.tool_input });
                if (valid) {
                  requested = true;
                  return {};
                }
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason:
                      'Unexpected question shape, selection mode or additional request.',
                  },
                };
              },
            ],
          },
        ],
      },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') initialTools = message.tools;
      if (message.type === 'assistant')
        for (const block of message.message.content) {
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
        }
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (
            block.type === 'tool_result' &&
            calls.some((call) => call.id === block.tool_use_id && call.name === 'AskUserQuestion')
          ) {
            results.push({
              id: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
          }
        }
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
  const event = callbackEvents[0];
  const question = event ? nativeQuestionSchema.parse(event.originalInput).questions[0] : null;
  const response = event ? responseText(event.answer) : null;
  const native = results.find((result) => result.id === event?.id);
  const parsed = outputSchema.safeParse(rawOutput);
  const modelOutput = parsed.success ? parsed.data : null;
  const mappedAnswers = event?.updatedInput.answers as Record<string, string> | undefined;
  const output =
    question && mappedAnswers
      ? { question: question.question, answer: mappedAnswers[question.question] }
      : null;
  const modelEchoExact = Boolean(output && isDeepStrictEqual(modelOutput, output));
  const checks = {
    nativeQuestionToolAdvertised: initialTools.includes('AskUserQuestion'),
    oneActualQuestionAnswered:
      questions.history.length === 1 &&
      questions.history[0].status === 'answered' &&
      callbackEvents.length === 1,
    originalQuestionsPreserved: Boolean(
      event && isDeepStrictEqual(event.originalInput.questions, event.updatedInput.questions),
    ),
    actualQuestionTextKeyUsed: Boolean(
      event &&
      question &&
      isDeepStrictEqual(event.updatedInput.answers, { [question.question]: response }),
    ),
    nativeAnswerAccepted: Boolean(native && !native.isError),
    nativeAnswerContainsResponse: Boolean(
      native &&
      response &&
      JSON.stringify(native.content).includes(JSON.stringify(response).slice(1, -1)),
    ),
    blockedAttemptsReturnedErrors: observedRequests
      .filter((request) => !request.valid)
      .every((request) => results.some((result) => result.id === request.id && result.isError)),
    recordedAnswerMatchesMapping: Boolean(
      question && isDeepStrictEqual(output, { question: question.question, answer: response }),
    ),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      initialTools,
      questions: questions.history,
      callbackEvents,
      observedRequests,
      calls,
      results,
      output,
      modelOutput,
      modelEchoExact,
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
