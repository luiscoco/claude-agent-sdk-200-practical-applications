import { checkpointExperiment } from './checkpoints.js';
import { report } from './native.js';
export async function run(mode: string) {
  const observed = await checkpointExperiment(mode === 'live');
  const id = observed.first.value.checkpointId;
  return report({ checkpointId: id, nativeSessionId: observed.first.sessionId, observed: observed.first.value }, {
    ownedUserMessageUuidCaptured: /^[0-9a-f-]{36}$/i.test(id),
    actualCheckpointControlResponded: mode === 'live' ? Boolean((observed.first.value as any).preview) : typeof observed.first.value.baselinePreview?.canRewind === 'boolean',
    ...(mode === 'live' ? { actualModelEditWasTracked: observed.actualModelEditObserved,
      restoredOriginalContent: observed.first.value.after === 'State: ORIGINAL\n' } : {}),
  }, observed, 'Checkpointing is enabled on the real SDK query and the supplied user-message UUID is retained as the restore point. Local mode probes rewind dry-run support; only live mode claims an actual tracked model edit and restoration.');
}
