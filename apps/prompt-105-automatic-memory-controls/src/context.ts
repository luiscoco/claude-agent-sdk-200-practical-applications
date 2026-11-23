import { native, requireNative } from './native.js';
export async function measure(sessionId?: string) {
  const result = await native('/context', sessionId ? { resume: sessionId } : {});
  requireNative(result);
  const packet = result.events.find(e => e.type === 'assistant' && e.context_usage);
  if (!packet) throw new Error('Installed runtime did not return structured context_usage.');
  return { sessionId: result.sessionId, usage: packet.context_usage, events: result.events };
}
