import { z } from 'zod';
export const requestSchema = z.object({ key: z.string().min(1).max(64), quantity: z.number().int().min(1).max(5) }).strict();
export class AuthorizedTool {
  private results = new Map<string, { quantity: number; receipt: string }>();
  executions = 0;
  execute(role: string, raw: unknown, unavailable = false) {
    if (role !== 'operator') throw new Error('Unauthorized');
    const input = requestSchema.parse(raw); if (unavailable) throw new Error('Owned service unavailable');
    const prior = this.results.get(input.key); if (prior) { if (prior.quantity !== input.quantity) throw new Error('Idempotency conflict'); return prior; }
    const result = { quantity: input.quantity, receipt: 'RECEIPT-' + (++this.executions) }; this.results.set(input.key, result); return result;
  }
}
export function reduceEvents(events: any[]) {
  const state = { text: '', tools: [] as string[], approvals: 0, completed: false, failed: false, unknown: 0 };
  for (const event of events) {
    if (event.type === 'stream_event' && event.event?.type === 'content_block_delta' && event.event.delta?.type === 'text_delta') state.text += event.event.delta.text;
    else if (event.type === 'assistant') { for (const block of event.message?.content || []) if (block.type === 'tool_use') state.tools.push(block.name); }
    else if (event.type === 'approval') state.approvals++;
    if (event.type === 'result') { state.completed = event.subtype === 'success' && !event.is_error; state.failed = !state.completed; }
    if (!['system', 'assistant', 'user', 'result', 'stream_event', 'approval'].includes(event.type)) state.unknown++;
  }
  return state;
}
export function evaluate(answer: { text: string; evidenceIds: string[]; tools: string[]; completed: boolean }) {
  const rubric = { factualCorrectness: /three|3/.test(answer.text) && /retr/i.test(answer.text) && !/unlimited/i.test(answer.text), evidenceQuality: answer.evidenceIds.includes('D1'), toolSelection: answer.tools.includes('inspect'), completion: answer.completed && answer.text.length > 15 };
  return { rubric, score: Object.values(rubric).filter(Boolean).length, maximum: 4 };
}
