import { checkpointExperiment } from './checkpoints.js';
import { report } from './native.js';
export async function run(mode: string) {
  const observed = await checkpointExperiment(mode === 'live', true), initial = observed.first.value as any;
  return report({ originalSession: observed.first.sessionId, checkpoint: initial.checkpointId, resumed: observed.resumed?.value }, {
    actualSessionIdentityCaptured: Boolean(observed.first.sessionId),
    ...(observed.resumed ? { sameNativeSessionResumed: observed.resumed.sessionId === observed.first.sessionId,
      originalFileRestored: observed.resumed.value.after === 'State: ORIGINAL\n',
      editConversationRemainsAfterRewind: initial.beforeHistoryIds.every((id: string) => observed.resumed!.value.historyIds.includes(id)) } : {}),
  }, observed, 'Live mode closes the first runtime, explicitly resumes its session in a new runtime, restores tracked files and independently reads native history. File restoration does not claim to erase conversation history.');
}
