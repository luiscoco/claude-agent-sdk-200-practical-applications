import { randomUUID } from 'node:crypto';
import { native, requireNative, report } from './native.js';
import { recall } from './live.js';
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
export async function run(mode: string) {
  const marker = 'HISTORY_' + randomUUID();
  const seed = await native(`Owned classroom marker ${marker}. Retain this key fact.\n` + Array.from({ length: 120 }, (_, i) => `Queue item ${i}: retry delivery safely and preserve idempotency.`).join('\n'));
  const sessionId = requireNative(seed), before = await getSessionMessages(sessionId);
  if (mode !== 'live') {
    const fresh = await native('New independent classroom conversation.'); requireNative(fresh);
    return report({ originalId: sessionId, freshId: fresh.sessionId }, {
      freshHasDifferentIdentity: fresh.sessionId !== sessionId,
      freshDoesNotContainEarlierMarker: !JSON.stringify(await getSessionMessages(fresh.sessionId)).includes(marker),
    }, { seed, fresh }, 'Local comparison of stored history versus a new session. Compact and clear are exercised in live mode because compaction may call the model.');
  }
  const compact = await native('/compact Preserve the exact owned classroom marker.', { resume: sessionId });
  requireNative(compact, false);
  const compactRecall = await recall(sessionId, marker);
  const clear = await native('/clear', { resume: sessionId }); requireNative(clear, false);
  const clearId = clear.sessionId;
  const clearRecall = await native('What was the owned classroom marker from earlier? If unavailable, output UNKNOWN.', { resume: clearId }, true);
  requireNative(clearRecall, false);
  const fresh = await native('What was the owned classroom marker from earlier? If unavailable, output UNKNOWN.', {}, true);
  requireNative(fresh, false);
  const answer = (r: typeof fresh) => r.events.findLast(e => e.type === 'result')?.result ?? '';
  return report({ originalId: sessionId, clearId, freshId: fresh.sessionId,
    compactAnswer: compactRecall.answer, clearAnswer: answer(clearRecall), newAnswer: answer(fresh) }, {
    manualCompactionActuallyObserved: compact.events.some(e => e.type === 'system' && e.subtype === 'compact_boundary' && e.compact_metadata?.trigger === 'manual'),
    compactRetainsImportantFact: compactRecall.remembered,
    clearRemovesRecall: !answer(clearRecall).includes(marker),
    freshRemovesRecall: !answer(fresh).includes(marker),
    freshIdentityDiffers: fresh.sessionId !== sessionId && fresh.sessionId !== clearId,
  }, { seed, before, compact, compactRecall, clear, clearRecall, fresh }, 'Actual /compact and /clear commands, followed by real model recall probes and a new-session control. The observed clear identity is displayed without assuming it remains constant. A runtime that cannot execute a command fails explicitly.');
}
