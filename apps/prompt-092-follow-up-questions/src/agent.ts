import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomBytes, randomInt } from 'node:crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  answerSchema,
  requirementNames,
  sameRequirements,
} from './context-comparison.js';
import { publicReport } from './privacy.js';

export async function runFollowUps(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/followup-'));
  const nativeConfigDirectory = path.join(workspace, 'native-config');
  const marker = `FOLLOWUP_${randomBytes(4).toString('hex').toUpperCase()}`;
  const offset = randomInt(requirementNames.length),
    requirements = [
      requirementNames[offset],
      requirementNames[(offset + 1) % requirementNames.length],
    ];
  const originalContext = { marker, topic: requestedInput.topic, requirements };
  const instructions =
    'Return the structured answer fields from the conversation context. If earlier context is unavailable, set contextAvailable false, marker and topic null, and requirements empty. Do not invent missing context. Do not call tools.';
  const questions = [
    {
      label: 'Establish the classroom plan',
      question: `Remember this owned synthetic classroom plan: ${JSON.stringify(originalContext)}. Confirm its marker, topic and requirements.`,
      nextStepRequired: false,
    },
    {
      label: 'Recall the earlier plan',
      question: 'What exact marker, topic and requirements did I give earlier? Keep the same plan.',
      nextStepRequired: false,
    },
    {
      label: 'Apply the retained plan',
      question:
        'Using the earlier plan, return its original marker, topic and requirements, then suggest one brief next step consistent with those requirements.',
      nextStepRequired: true,
    },
  ];
  const turns: Array<Record<string, any>> = [];
  let firstSessionId: string | undefined;
  for (const [index, question] of questions.entries()) {
    const prompt = question.question + '\n' + instructions;
    const initIds: string[] = [],
      resultIds: string[] = [];
    let success = false,
      resultStatus = '',
      resultText = '',
      error = '',
      rawOutput: unknown;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 150000);
    const requestedResume =
      index > 0 && requestedInput.mode === 'resume' ? firstSessionId : undefined;
    const run = query({
      prompt,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        settingSources: [],
        strictMcpConfig: true,
        persistSession: true,
        ...(requestedResume ? { resume: requestedResume } : {}),
        env: { ...process.env, CLAUDE_CONFIG_DIR: nativeConfigDirectory },
        maxTurns: 4,
        maxBudgetUsd: 0.5,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(answerSchema, { target: 'draft-7' }),
        },
      },
    });
    try {
      for await (const message of run) {
        if (message.type === 'system' && message.subtype === 'init')
          initIds.push(message.session_id);
        if (message.type === 'result') {
          resultIds.push(message.session_id);
          resultStatus = message.subtype;
          success = message.subtype === 'success' && !message.is_error;
          if (message.subtype === 'success') {
            rawOutput = message.structured_output;
            resultText = message.result;
            if (message.is_error) error = message.result;
          } else error = message.errors.join('\n');
        }
      }
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    } finally {
      clearTimeout(timer);
      run.close();
    }
    firstSessionId ??= initIds[0];
    const parsed = answerSchema.safeParse(rawOutput),
      answer = parsed.success ? parsed.data : null;
    const contextExpected = index === 0 || requestedInput.mode === 'resume';
    const contextMatches = Boolean(
      answer &&
      answer.contextAvailable === contextExpected &&
      (contextExpected
        ? answer.marker === marker &&
          answer.topic === originalContext.topic &&
          sameRequirements(answer.requirements, requirements)
        : answer.marker === null && answer.topic === null && answer.requirements.length === 0),
    );
    turns.push({
      index: index + 1,
      label: question.label,
      prompt,
      requestedResume: requestedResume ?? null,
      initIds,
      resultIds,
      resultStatus,
      success,
      error,
      resultText,
      answer,
      contextExpected,
      contextMatches,
      nextStepRequired: question.nextStepRequired,
    });
    if (!success || error) break;
  }
  const sessionIds = turns.map((turn) => turn.initIds[0]);
  const checks = {
    threeActualNativeQueriesSucceeded:
      turns.length === 3 && turns.every((turn) => turn.success && !turn.error),
    eachInitAndResultSessionMatches: turns.every(
      (turn) =>
        turn.initIds.length === 1 &&
        turn.resultIds.length === 1 &&
        Boolean(turn.initIds[0]) &&
        turn.initIds[0] === turn.resultIds[0],
    ),
    nativeSessionSelectionMatches:
      turns.length === 3 &&
      (requestedInput.mode === 'resume'
        ? new Set(sessionIds).size === 1
        : new Set(sessionIds).size === 3),
    explicitResumeBindingMatches: turns.every(
      (turn, index) =>
        turn.requestedResume ===
        (index > 0 && requestedInput.mode === 'resume' ? firstSessionId : null),
    ),
    actualContextAvailabilityMatches:
      turns.length === 3 && turns.every((turn) => turn.contextMatches),
    randomMarkerNotRestatedInFollowUps: questions
      .slice(1)
      .every((question) => !question.question.includes(marker)),
    followUpsDoNotRestateSelectedRequirements: questions
      .slice(1)
      .every((question) =>
        requirements.every((requirement) => !question.question.includes(requirement)),
      ),
    requestedNextStepActuallyReturned:
      turns.length === 3 &&
      turns
        .filter((turn) => turn.nextStepRequired)
        .every(
          (turn) =>
            typeof turn.answer?.nextStep === 'string' && turn.answer.nextStep.trim().length > 0,
        ),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      nativeConfigDirectory,
      originalContext,
      turns,
      output: {
        actualQueries: turns.length,
        distinctNativeSessions: new Set(sessionIds).size,
        answers: turns.map((turn) => ({
          index: turn.index,
          nativeSessionId: turn.initIds[0],
          answer: turn.answer,
        })),
      },
      fixtureDisclosure:
        'Owned synthetic classroom plan. Follow-up questions omit the random marker and selected requirement values. Fresh mode intentionally starts separate native conversations for comparison.',
      checks,
      error: turns
        .map((turn) => turn.error)
        .filter(Boolean)
        .join('\n'),
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
