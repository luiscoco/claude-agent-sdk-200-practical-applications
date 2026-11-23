import { checkpointExperiment } from './checkpoints.js';
import { report } from './native.js';
export async function run(mode: string) {
  const observed = await checkpointExperiment(mode === 'live'), state = observed.first.value as any;
  return report(state, { actualNativePreviewReturned: typeof (state.preview ?? state.baselinePreview)?.canRewind === 'boolean',
    ...(mode === 'live' ? { actualEditObserved: observed.actualModelEditObserved,
      previewDidNotChangeOwnedFile: state.previewPreservedFile,
      nativePreviewAllowsRestoration: state.preview.canRewind,
      actualRewindRestoredOriginal: state.rewind.canRewind && state.after === 'State: ORIGINAL\n' } : {}),
  }, observed, 'A preview is a real rewindFiles({dryRun:true}) call. It must leave the edited file unchanged. Restoration then calls the non-dry-run API and checks the actual file contents.');
}
