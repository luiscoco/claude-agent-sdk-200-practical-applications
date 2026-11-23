import { query, type Options, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'node:crypto';
export type Turn = { promptId: string; text: string; infer: boolean; result: any; events: any[] };
export async function conversation<T>(options: Options, action: (host: {
  runtime: Query; events: any[]; baseline: Turn;
  send: (text: string, infer?: boolean) => Promise<Turn>;
  waitFor: (predicate: (event: any) => boolean, milliseconds?: number) => Promise<any>;
}) => Promise<T>) {
  const events: any[] = [], queue: SDKUserMessage[] = [], pending = new Map<string, { resolve: (value: Turn) => void; reject: (error: Error) => void; start: number; text: string; infer: boolean }>();
  let wake: (() => void) | undefined, ended = false;
  async function* input(): AsyncGenerator<SDKUserMessage> {
    while (!ended || queue.length) {
      if (queue.length) yield queue.shift()!;
      else await new Promise<void>(resolve => { wake = resolve; });
    }
  }
  const abortController = new AbortController(), timer = setTimeout(() => abortController.abort(), 240000);
  const runtime = query({ prompt: input(), options: { cwd: process.env.LAB_WORKSPACE,
    settingSources: [], strictMcpConfig: true, tools: [], model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    env: { ...process.env }, maxBudgetUsd: 0.75, maxTurns: 10, ...options, abortController } });
  let streamError: unknown;
  const pump = (async () => {
    try {
      for await (const event of runtime) {
        events.push(event);
        if (event.type !== 'result') continue;
        for (const [id, waiter] of pending) {
          const packet = event as any;
          if (packet.user_message_uuid !== id && !packet.user_message_uuids?.includes(id) && pending.size !== 1) continue;
          pending.delete(id); waiter.resolve({ promptId: id, text: waiter.text, infer: waiter.infer,
            result: event, events: events.slice(waiter.start) }); break;
        }
      }
    } catch (error) { streamError = error; }
    finally { for (const waiter of pending.values()) waiter.reject(new Error('Native stream ended before the requested turn completed.')); }
  })();
  async function send(text: string, infer = false): Promise<Turn> {
    const id = randomUUID();
    const result = new Promise<Turn>((resolve, reject) => pending.set(id, { resolve, reject, text, infer, start: events.length }));
    queue.push({ type: 'user', uuid: id, message: { role: 'user', content: text }, parent_tool_use_id: null, shouldQuery: infer });
    wake?.(); wake = undefined;
    const turn = await result;
    if (turn.result.is_error || turn.result.subtype !== 'success') throw new Error(JSON.stringify(turn.result));
    if (!infer && (turn.result.num_turns !== 0 || turn.result.duration_api_ms !== 0)) throw new Error('Expected a zero-inference local turn.');
    return turn;
  }
  async function waitFor(predicate: (event: any) => boolean, milliseconds = 15000) {
    const until = Date.now() + milliseconds;
    while (Date.now() < until) {
      const found = events.find(predicate); if (found) return found;
      if (streamError) throw streamError;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Expected native event was not observed before the deadline.');
  }
  try {
    const baseline = await send('Owned classroom conversation setup; no assistant inference requested.');
    const value = await action({ runtime, events, baseline, send, waitFor });
    ended = true; wake?.(); await pump;
    if (streamError) throw streamError;
    return { value, baseline, events, sessionId: baseline.result.session_id,
      init: events.find((e: any) => e.type === 'system' && e.subtype === 'init') };
  } finally { ended = true; wake?.(); clearTimeout(timer); runtime.close(); await pump; }
}
export function toolCalls(events: any[], name?: string) {
  return events.flatMap(e => e.type === 'assistant' && Array.isArray(e.message?.content)
    ? e.message.content.filter((b: any) => b.type === 'tool_use' && (!name || b.name === name)) : []);
}
