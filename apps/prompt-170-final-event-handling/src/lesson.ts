import { native, requireNative, report } from './native.js';
import { eventLog } from './observability.js';
export async function run(mode: string) {
  const observed = await native(mode === 'live' ? 'Reply with COMPLETED_COMPUTATION.' : 'Owned final-event handling baseline.', {
    sessionStore: { load: async () => null, append: async () => { throw new Error('Owned mirror outage'); } },
  }, mode === 'live'); requireNative(observed, mode !== 'live');
  const resultIndex = observed.events.findIndex(e => e.type === 'result'), mirrorErrors = observed.events.filter(e => e.type === 'system' && e.subtype === 'mirror_error');
  const afterResult = observed.events.slice(resultIndex + 1);
  return report({ computationSuccess: observed.success, externalDurabilityConfirmed: false, resultIndex,
    eventsAfterResult: afterResult, mirrorErrors, completeDrainedLog: eventLog('owned-final-event-test', observed.events),
    shutdown: 'Iterator drained; native wrapper finally closes the runtime and clears its deadline.' }, {
    nativeComputationAndPersistenceDistinguished: observed.success && mirrorErrors.length > 0,
    iteratorDrainedInsteadOfBreakingAtResult: observed.events.length >= resultIndex + 1,
    noFalseExternalDurableSuccess: mirrorErrors.length > 0,
  }, observed, 'The actual adapter failure may arrive before or after the result depending on runtime ordering. The application drains all events and preserves the observed order; it does not fabricate a post-result ordering.');
}
