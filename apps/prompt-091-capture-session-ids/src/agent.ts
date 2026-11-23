import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  requestSchema,
  insertConversation,
  readConversation,
  type Conversation,
} from './conversation-store.js';
import { publicReport } from './privacy.js';

const summarySchema = z
  .object({ topic: z.enum(['MCP', 'Hooks']), summary: z.string().min(1).max(180) })
  .strict();
const facts = {
  MCP: 'The Claude Agent SDK can connect to external tools through Model Context Protocol servers.',
  Hooks: 'The Claude Agent SDK can run application callbacks at supported lifecycle events.',
};
export async function runSessionCapture(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const storeDirectory = path.join(root, 'runs/conversations');
  const observations: Array<Record<string, any>> = [],
    records: Conversation[] = [];
  const topics: Array<'MCP' | 'Hooks'> =
    requestedInput.mode === 'single'
      ? [requestedInput.topic]
      : [requestedInput.topic, requestedInput.topic === 'MCP' ? 'Hooks' : 'MCP'];
  for (const [index, topic] of topics.entries()) {
    const workspace = await mkdtemp(path.join(root, 'runs/session-'));
    const nativeConfigDirectory = path.join(workspace, 'native-config');
    const conversationId = randomUUID(),
      label = `Classroom conversation ${index + 1} · ${topic}`;
    const initIds: string[] = [],
      resultIds: string[] = [];
    let rawOutput: unknown,
      resultText = '',
      success = false,
      error = '',
      resultStatus = '';
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 120000);
    const run = query({
      prompt: `For topic ${topic}, summarize this provided classroom fact in one short sentence: ${facts[topic]}. Return the topic and summary. Do not use tools.`,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        settingSources: [],
        strictMcpConfig: true,
        persistSession: true,
        env: { ...process.env, CLAUDE_CONFIG_DIR: nativeConfigDirectory },
        maxTurns: 4,
        maxBudgetUsd: 0.4,
        abortController: controller,
        outputFormat: {
          type: 'json_schema',
          schema: z.toJSONSchema(summarySchema, { target: 'draft-7' }),
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
          } else error = message.errors.join('\n');
        }
      }
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    } finally {
      clearTimeout(timer);
      run.close();
    }
    const parsed = summarySchema.safeParse(rawOutput),
      output = parsed.success ? parsed.data : null;
    const nativeIdentityValid =
      initIds.length === 1 &&
      resultIds.length === 1 &&
      Boolean(initIds[0]) &&
      initIds[0] === resultIds[0];
    const observed = {
      conversationId,
      topic,
      initIds,
      resultIds,
      output,
      resultText,
      resultStatus,
      success,
      error,
      nativeIdentityValid,
    };
    observations.push(observed);
    if (success && !error && nativeIdentityValid && output?.topic === topic) {
      records.push(
        await insertConversation(storeDirectory, {
          conversationId,
          label,
          topic,
          sdkSessionId: initIds[0],
          workspace,
          nativeConfigDirectory,
          summary: output.summary,
          createdAt: new Date().toISOString(),
        }),
      );
    } else break;
  }
  let rebindControl: Record<string, any> | null = null;
  if (requestedInput.mode === 'pair' && records.length === 2) {
    rebindControl = {
      conversationId: records[0].conversationId,
      originalSdkSessionId: records[0].sdkSessionId,
      attemptedSdkSessionId: records[1].sdkSessionId,
      rejected: false,
      errorCode: null,
    };
    try {
      await insertConversation(storeDirectory, {
        ...records[0],
        sdkSessionId: records[1].sdkSessionId,
      });
    } catch (failure) {
      rebindControl.errorCode = (failure as NodeJS.ErrnoException).code;
      rebindControl.rejected = rebindControl.errorCode === 'EEXIST';
    }
  }
  const readBack = await Promise.all(
    records.map((record) => readConversation(storeDirectory, record.conversationId)),
  );
  const checks = {
    actualNativeQueriesSucceeded:
      observations.length === topics.length &&
      observations.every((item) => item.success && !item.error),
    initAndResultNativeIdentifiersMatch: observations.every((item) => item.nativeIdentityValid),
    applicationRecordsCreatedAfterActualCapture:
      records.length === topics.length &&
      records.every(
        (record, index) =>
          record.conversationId === observations[index]?.conversationId &&
          record.sdkSessionId === observations[index]?.initIds[0],
      ),
    applicationAndNativeIdentifiersSeparated: records.every(
      (record) => record.conversationId !== record.sdkSessionId,
    ),
    persistedRecordsReadBackExactly:
      records.length === topics.length &&
      readBack.every((record, index) => isDeepStrictEqual(record, records[index])),
    structuredTopicMatchesConversation: observations.every(
      (item) => item.output?.topic === item.topic,
    ),
    distinctConversationAndNativeSessions:
      new Set(records.map((record) => record.conversationId)).size === topics.length &&
      new Set(records.map((record) => record.sdkSessionId)).size === topics.length,
    actualWrongSessionRebindRejected:
      requestedInput.mode === 'pair'
        ? Boolean(
            rebindControl?.rejected &&
            rebindControl.originalSdkSessionId !== rebindControl.attemptedSdkSessionId &&
            readBack[0]?.sdkSessionId === rebindControl.originalSdkSessionId,
          )
        : true,
  };
  return publicReport(
    {
      requestedInput,
      storeDirectory,
      observations,
      records,
      readBack,
      rebindControl,
      output: {
        createdConversations: records.length,
        records: records.map((record) => ({
          conversationId: record.conversationId,
          sdkSessionId: record.sdkSessionId,
          topic: record.topic,
          summary: record.summary,
        })),
        wrongRebindRejected: rebindControl?.rejected ?? null,
      },
      fixtureDisclosure:
        'Local single-user classroom conversation store. Summaries describe supplied synthetic lesson facts. Native session identifiers are captured from actual SDK messages and treated as opaque strings.',
      checks,
      error: observations
        .map((item) => item.error)
        .filter(Boolean)
        .join('\n'),
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
