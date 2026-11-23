import { randomUUID } from 'node:crypto';
import { native, requireNative, report } from './native.js';
import { measure } from './context.js';
import { recall } from './live.js';
export async function run(mode: string) {
  if (mode !== 'live') {
    const small = await native('Classroom baseline: a short conversation.');
    const id = requireNative(small), context = await measure(id);
    return report({ context: context.usage, automaticCompactionObserved: false }, { nativeBaselineMeasured: true },
      { small, context }, 'Local baseline only. Automatic compaction requires a live inference request on a sufficiently long conversation. Choose Live automatic compaction to perform that experiment.');
  }
  const marker = 'COMPACT_' + randomUUID();
  const rows = Array.from({ length: 3600 }, (_, i) => `Record ${i}: task queue batch ${i % 71} has retry policy ${i % 5}, owner classroom, status queued, with idempotency required.`).join('\n');
  const seed = await native(`Owned classroom marker ${marker}. This is the important fact to retain.\n${rows}\nCritical fact repeated at end: ${marker}.`, {
    settings: { autoCompactEnabled: true, autoCompactWindow: 100000 },
  });
  const sessionId = requireNative(seed), before = await measure(sessionId);
  const hooks: any[] = [];
  const result = await native('Summarize the queue dataset in one sentence, preserving the exact owned classroom marker.', {
    resume: sessionId, settings: { autoCompactEnabled: true, autoCompactWindow: 100000 },
    hooks: {
      PreCompact: [{ hooks: [async input => { hooks.push(input); return {}; }] }],
      PostCompact: [{ hooks: [async input => { hooks.push(input); return {}; }] }],
    },
  }, true);
  requireNative(result, false);
  const after = await measure(sessionId), remembered = await recall(sessionId, marker);
  const boundaries = result.events.filter(e => e.type === 'system' && e.subtype === 'compact_boundary');
  return report({ before: before.usage, after: after.usage, boundaries, marker, recalledAnswer: remembered.answer }, {
    automaticBoundaryActuallyObserved: boundaries.some(e => e.compact_metadata?.trigger === 'auto'),
    automaticHookActuallyObserved: hooks.some(e => e.trigger === 'auto'),
    nativeContextReduced: after.usage.total_tokens < before.usage.total_tokens,
    liveModelRetainsImportantFact: remembered.remembered,
  }, { seed, result, hooks, remembered }, 'Actual automatic compaction at a configured 100,000-token window with a large owned synthetic queue dataset. Only native compact_boundary trigger:auto counts as observation. Failure to trigger is reported as an unmet check. Model and summary calls incur account charges.');
}
