import express from 'express';
import { installChat } from './chat.js';
import { parseSse } from './streaming.js';
import { report } from './native.js';
export async function run(mode: string) {
  const app = express(); app.use(express.json()); installChat(app, process.env.LAB_WORKSPACE!);
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); }); const endpoint = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const initial = await fetch(endpoint + '/chat-api/history'), cookie = initial.headers.get('set-cookie')!.split(';')[0];
    const response = await fetch(endpoint + '/chat-api/turn', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Explain one agent permission safeguard without calling a tool.', mode }) });
    const events = parseSse(await response.text()), history = await (await fetch(endpoint + '/chat-api/history', { headers: { Cookie: cookie } })).json() as any;
    const other = await (await fetch(endpoint + '/chat-api/history')).json() as any;
    return report({ chatUrl: '/chat.html', history, events }, { streamCompletes: events.some(event => event.event === 'done'), nativeResultObserved: events.some(event => event.event === 'sdk' && event.data.type === 'result' && event.data.subtype === 'success'), sessionHistoryRetained: history.history.length === 1, otherBrowserIsolated: other.history.length === 0 && history.session !== other.session }, events, 'Open /chat.html for actual chat, streamed SDK/tool events, history, cancel and per-write approval. History is ephemeral in this teaching process. Live approval requires a real Write request for note.txt; no approval event is fabricated locally.');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
