import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export function gate(capabilities: string[], requested: string) { return capabilities.includes(requested); }
export async function run(mode: string) {
  const discovery = await inspect({}, async runtime => ({ receipt: await runtime.interrupt() }));
  const capabilities: string[] = discovery.init?.capabilities ?? [];
  const supported = gate(capabilities, 'interrupt_receipt_v1');
  const live = mode === 'live' ? await native('In one sentence, explain why an application should feature-detect protocol capabilities before using an advanced control.', {}, true) : null;
  if (live) requireNative(live, false);
  const receipt = (discovery.change as any).receipt;
  return report({ nativeVersion: discovery.init?.claude_code_version, capabilities, advancedInterruptReceiptEnabled: supported, receipt,
    fallback: supported ? null : 'Treat interrupt completion as acknowledgement only; no structured queue receipt is assumed.' }, {
    nativeCapabilityInventoryCaptured: Array.isArray(capabilities),
    unknownFutureCapabilityFailsClosed: !gate(capabilities, 'classroom_not_a_real_capability'),
    advertisedReceiptMatchesNativeResponse: !supported || Array.isArray(receipt?.still_queued),
    ...(live ? { actualModelCompleted: live.success } : {}),
  }, { discovery, live }, 'The gate uses exact advertised capability strings, not a version comparison or the existence of a JavaScript method. An unknown capability remains disabled.');
}
