import { native, requireNative, report } from './native.js';
import { incrementalCost } from './accounting.js';
export async function run(mode: string) {
  const first = await native(mode === 'live' ? 'Remember the owned queue has three retries. Reply OK.' : 'Owned accounting conversation.', {}, mode === 'live');
  const id = requireNative(first, mode !== 'live');
  const second = await native(mode === 'live' ? 'What retry count did we agree? Reply with the number.' : 'Owned transcript follow-up.', { resume: id }, mode === 'live');
  requireNative(second, mode !== 'live');
  const delta = incrementalCost(first.costUsd, second.costUsd), resetFixture = incrementalCost(1, 0.1);
  return report({ sessionId: id, beforeUsd: first.costUsd, afterUsd: second.costUsd, observedDelta: delta, resetFixture }, {
    exactConversationResumed: second.sessionId === first.sessionId,
    counterResetNotSilentlySubtracted: resetFixture.resetDetected && resetFixture.incrementalUsd === null,
    observedDeltaIsValidOrExplicitlyReset: delta.resetDetected || (delta.incrementalUsd !== null && delta.incrementalUsd >= 0),
  }, { first, second }, 'The ledger subtracts cumulative estimates only within one identified session/epoch. A counter decrease is reported explicitly, including after clear/reset, rather than silently treating the latest total as incremental spending.');
}
