import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'node:crypto';
import { native, requireNative, report } from './native.js';
import { recall } from './live.js';
export async function run(mode: string) {
  const live = mode === 'live';
  const marker = 'FORK_' + randomUUID();
  const seed = await native(`Classroom architecture decision ${marker}: design a task queue. Compare relational SQL storage and a Redis queue in separate branches.`);
  const originalId = requireNative(seed);
  const before = await getSessionMessages(originalId);
  const sql = await native(live ? 'Explore only the relational SQL approach in three concise points.' : 'Branch SQL: choose database transactions and a jobs table.',
    { resume: originalId, forkSession: true }, live);
  const sqlId = requireNative(sql, !live);
  const redis = await native(live ? 'Explore only the Redis approach in three concise points.' : 'Branch REDIS: choose Redis streams and consumer groups.',
    { resume: originalId, forkSession: true }, live);
  const redisId = requireNative(redis, !live);
  const original = await getSessionMessages(originalId), left = await getSessionMessages(sqlId), right = await getSessionMessages(redisId);
  const remembered = live ? await recall(sqlId, marker) : null;
  const text = (history: unknown) => JSON.stringify(history);
  const ids = (history: typeof left) => history.map(m => m.uuid);
  return report({ originalId, sqlId, redisId, marker, original, sql: left, redis: right }, {
    threeDistinctNativeSessions: new Set([originalId, sqlId, redisId]).size === 3,
    originalHistoryUnchanged: text(before) === text(original),
    seedInheritedInBothBranches: text(left).includes(marker) && text(right).includes(marker),
    sqlPromptOnlyInSql: ids(left).includes(sql.promptId) && !ids(right).includes(sql.promptId),
    redisPromptOnlyInRedis: ids(right).includes(redis.promptId) && !ids(left).includes(redis.promptId),
    neitherBranchAppendedToOriginal: !ids(original).includes(sql.promptId) && !ids(original).includes(redis.promptId),
    ...(remembered ? { liveModelRecallsInheritedMarker: remembered.remembered } : {}),
  }, { seed, sql, redis, remembered }, live
    ? 'Actual model responses explore two approaches in separate forked native conversations. Filesystem snapshots are not forked.'
    : 'Actual native transcript-only forks. Branch decisions are supplied classroom inputs; no model reasoning or file rollback is claimed. Run live for real model exploration.');
}
