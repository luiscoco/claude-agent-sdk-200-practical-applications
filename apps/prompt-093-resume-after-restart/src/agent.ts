import path from 'node:path';
import { loadConversation, requestSchema } from './restart-store.js';
import { runApplicationWorker } from './worker-process.js';
import { publicReport } from './privacy.js';

export async function runRestartComparison(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  const seed = await runApplicationWorker('seed', requestedInput.topic);
  if (seed.exitCode !== 0 || !seed.result.record)
    throw new Error(
      seed.result.error || 'Seed application worker did not create a validated session mapping.',
    );
  // The first application worker has exited. The new worker receives only the saved app ID.
  const restored = await runApplicationWorker(
    requestedInput.mode,
    seed.result.record.conversationId,
  );
  const savedRecord = await loadConversation(
    path.resolve(import.meta.dirname, '../runs/conversations'),
    seed.result.record.conversationId,
  );
  const expected = seed.result.expectedContext,
    answer = restored.result.answer;
  const contextMatches = Boolean(
    answer &&
    (requestedInput.mode === 'resume'
      ? answer.contextAvailable &&
        answer.marker === expected.marker &&
        answer.topic === expected.topic
      : !answer.contextAvailable && answer.marker === null && answer.topic === null),
  );
  const checks = {
    seedNativeQuerySucceeded:
      seed.exitCode === 0 && seed.result.success && seed.result.nativeIdentityValid,
    firstWorkerExitedBeforeRestart:
      seed.exitCode === 0 && Date.parse(restored.spawnedAt) >= Date.parse(seed.exitedAt),
    distinctActualWorkerInstances: seed.result.workerInstance !== restored.result.workerInstance,
    actualWorkerIdentityCaptured:
      seed.pid === seed.result.pid && restored.pid === restored.result.pid,
    restoredNativeQuerySucceeded:
      restored.exitCode === 0 && restored.result.success && restored.result.nativeIdentityValid,
    savedRecordContainsNoClassroomAnswer: !('marker' in savedRecord) && !('topic' in savedRecord),
    newWorkerLoadedExactStoredMapping:
      JSON.stringify(restored.result.record) === JSON.stringify(savedRecord),
    explicitResumeSelectionMatches:
      restored.result.requestedResume ===
      (requestedInput.mode === 'resume' ? savedRecord.sdkSessionId : null),
    actualNativeSessionMatchesSelection:
      requestedInput.mode === 'resume'
        ? restored.result.initIds?.[0] === savedRecord.sdkSessionId
        : Boolean(restored.result.initIds?.[0]) &&
          restored.result.initIds[0] !== savedRecord.sdkSessionId,
    followUpDoesNotRestateOriginalMarker: !restored.result.prompt?.includes(expected.marker),
    actualRestoredContextMatches: contextMatches,
  };
  return publicReport(
    {
      requestedInput,
      seed,
      restored,
      savedRecord,
      expectedContext: expected,
      output: {
        seedPid: seed.pid,
        restoredPid: restored.pid,
        sdkSessionId: savedRecord.sdkSessionId,
        contextMatches,
      },
      fixtureDisclosure:
        'Owned synthetic context. The web coordinator remains running while the actual application worker exits and is relaunched. Independent CLI seed/resume commands can also be run across terminal/application restarts.',
      checks,
      error: restored.result.error || '',
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
