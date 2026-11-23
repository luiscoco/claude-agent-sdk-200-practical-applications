import 'dotenv/config';
import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { loadConversation, saveConversation, type SavedConversation } from './restart-store.js';

const root = path.resolve(import.meta.dirname, '..');
const recordDirectory = path.join(root, 'runs/conversations');
const workerInstance = randomUUID();
const startedAt = new Date().toISOString();
const answerSchema = z
  .object({
    contextAvailable: z.boolean(),
    marker: z
      .string()
      .regex(/^RESTART_[A-F0-9]{8}$/)
      .nullable(),
    topic: z.enum(['MCP', 'Hooks']).nullable(),
  })
  .strict();

async function main() {
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const operation = z.enum(['seed', 'resume', 'fresh']).parse(process.argv[2]);
  let record: SavedConversation | undefined;
  let expectedContext: { marker: string; topic: 'MCP' | 'Hooks' } | undefined;
  let workspace: string, nativeConfigDirectory: string;
  if (operation === 'seed') {
    const topic = z.enum(['MCP', 'Hooks']).parse(process.argv[3] || 'MCP');
    await mkdir(path.join(root, 'runs'), { recursive: true });
    workspace = await mkdtemp(path.join(root, 'runs/restart-'));
    nativeConfigDirectory = path.join(workspace, 'native-config');
    expectedContext = { marker: `RESTART_${randomBytes(4).toString('hex').toUpperCase()}`, topic };
  } else {
    record = await loadConversation(recordDirectory, process.argv[3] || '');
    ({ workspace, nativeConfigDirectory } = record);
  }
  const prompt =
    operation === 'seed'
      ? `Remember this owned synthetic classroom context: ${JSON.stringify(expectedContext)}. Confirm its exact values in the structured answer.`
      : 'What exact classroom marker and topic did I give before the application process exited? Use earlier conversation context. If unavailable, report contextAvailable false and null marker/topic. Do not invent values.';
  const initIds: string[] = [],
    resultIds: string[] = [];
  let success = false,
    resultText = '',
    error = '',
    rawAnswer: unknown;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 150000);
  const requestedResume = operation === 'resume' ? record!.sdkSessionId : null;
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
      if (message.type === 'system' && message.subtype === 'init') initIds.push(message.session_id);
      if (message.type === 'result') {
        resultIds.push(message.session_id);
        success = message.subtype === 'success' && !message.is_error;
        if (message.subtype === 'success') {
          resultText = message.result;
          rawAnswer = message.structured_output;
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
  const parsed = answerSchema.safeParse(rawAnswer),
    answer = parsed.success ? parsed.data : null;
  const nativeIdentityValid =
    initIds.length === 1 &&
    resultIds.length === 1 &&
    Boolean(initIds[0]) &&
    initIds[0] === resultIds[0];
  if (
    operation === 'seed' &&
    success &&
    !error &&
    nativeIdentityValid &&
    answer?.contextAvailable &&
    answer.marker === expectedContext!.marker &&
    answer.topic === expectedContext!.topic
  ) {
    record = await saveConversation(recordDirectory, {
      conversationId: randomUUID(),
      sdkSessionId: initIds[0],
      workspace,
      nativeConfigDirectory,
      createdAt: new Date().toISOString(),
    });
  }
  const result = {
    operation,
    pid: process.pid,
    workerInstance,
    startedAt,
    finishedAt: new Date().toISOString(),
    prompt,
    requestedResume,
    initIds,
    resultIds,
    nativeIdentityValid,
    success,
    resultText,
    answer,
    record: record ?? null,
    expectedContext: expectedContext ?? null,
    error,
  };
  console.log(JSON.stringify(result));
  if (!success || error || !nativeIdentityValid || !answer || !record) process.exitCode = 1;
}
try {
  await main();
} catch (failure) {
  let error = failure instanceof Error ? failure.message : String(failure);
  if (process.env.ANTHROPIC_API_KEY)
    error = error.replaceAll(process.env.ANTHROPIC_API_KEY, '[REDACTED]');
  console.log(JSON.stringify({ pid: process.pid, workerInstance, startedAt, error }));
  process.exitCode = 1;
}
