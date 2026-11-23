import { native, requireNative } from './native.js';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
/** Successful completion alone is insufficient: require the random lesson fact. */
export async function recall(sessionId: string, marker: string, options: Options = {}) {
  const result = await native('Return the exact owned classroom marker from earlier in this conversation. Output only the marker, with no explanation.',
    { ...options, resume: sessionId }, true);
  requireNative(result, false);
  const answer = result.events.findLast(e => e.type === 'result')?.result ?? '';
  return { result, answer, remembered: answer.trim() === marker };
}
