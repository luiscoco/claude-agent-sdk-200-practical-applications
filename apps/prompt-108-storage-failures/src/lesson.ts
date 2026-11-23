import path from 'node:path';
import { FileSessionStore } from './store.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const store = new FileSessionStore(path.join(process.env.LAB_RUN!, 'store'));
  let attempts = 0;
  const failed = await native('Owned classroom transcript with an intentionally unavailable mirror.', {
    sessionStore: { load: key => store.load(key), append: async () => { attempts++; throw new Error('Classroom injected storage outage'); } },
  }, mode === 'live');
  const sessionId = requireNative(failed, mode !== 'live');
  const mirrorErrors = failed.events.filter(e => e.type === 'system' && e.subtype === 'mirror_error');
  const stored = await store.load({ projectKey: process.env.CLAUDE_CODE_PROJECT_DIR_NAME!, sessionId });
  const durableSuccess = failed.success && mirrorErrors.length === 0 && Boolean(stored?.some(e => e.uuid === failed.promptId));
  const recovered = await native('Owned classroom fresh session after storage recovery. Reply with: storage recovered', { sessionStore: store }, mode === 'live');
  const recoveredId = requireNative(recovered, mode !== 'live');
  const recoveredEntries = await store.load({ projectKey: process.env.CLAUDE_CODE_PROJECT_DIR_NAME!, sessionId: recoveredId });
  return report({ computationSuccess: failed.success, durableSuccess, attempts, mirrorErrors,
    recoveredDurableSuccess: Boolean(recoveredEntries?.some(e => e.uuid === recovered.promptId)),
    recoveryNote: 'A fresh successful write does not repair the dropped batch from the earlier session.' }, {
    nativeContinuesAfterMirrorFailure: failed.success,
    actualMirrorErrorEventObserved: mirrorErrors.length > 0,
    failedBatchRetried: attempts >= 3,
    failedWriteNotReportedDurable: !durableSuccess && stored === null,
    recoveryActuallyPersistsNewSession: Boolean(recoveredEntries?.some(e => e.uuid === recovered.promptId)),
  }, { failed, recovered }, 'Actual SDK mirror retries and mirror_error events from a deliberately rejecting adapter. Agent computation success is tracked independently from application-confirmed external persistence. No provider inference is used.');
}
