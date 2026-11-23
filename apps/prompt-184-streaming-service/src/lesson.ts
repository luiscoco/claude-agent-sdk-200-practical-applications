import { streamService, parseSse } from './streaming.js';
import { report } from './native.js';
export async function run(mode: string) {
  const api = await streamService(mode === 'live');
  try {
    const response = await fetch(api.endpoint + '/events'), events = parseSse(await response.text());
    const pending = await fetch(api.endpoint + '/events'), reader = pending.body!.getReader(), first = await reader.read();
    const initial = parseSse(new TextDecoder().decode(first.value)), id = initial.find(event => event.event === 'started')?.data.id;
    const cancelled = await fetch(api.endpoint + '/cancel/' + id, { method: 'POST' });
    let tail = ''; while (true) { const chunk = await reader.read(); if (chunk.done) break; tail += new TextDecoder().decode(chunk.value); }
    const cancellation = parseSse(tail);
    return report({ events, cancellation }, { streamedNativeInit: events.some(event => event.event === 'sdk' && event.data.type === 'system' && event.data.subtype === 'init'), completionEvent: events.some(event => event.event === 'done' && event.data.resultSeen), cancellationAccepted: cancelled.status === 202, cancellationReported: cancellation.some(event => event.event === 'done' && event.data.cancelled) }, { events, cancellation }, 'Actual loopback SSE transport, native events and explicit cancellation. Browser clients must buffer incomplete packets. Reverse-proxy streaming needs a separate deployment test.');
  } finally { await api.close(); }
}
