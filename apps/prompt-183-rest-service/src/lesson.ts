import { service } from './service.js';
import { report } from './native.js';
export async function run(mode: string) {
  const api = await service(mode === 'live');
  const request = (route: string, owner = 'alice', body?: any) => fetch(api.endpoint + route, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + (api.tokens as any)[owner], 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const unauthorized = await fetch(api.endpoint + '/sessions/unknown');
    const created = await fetch(api.endpoint + '/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + api.tokens.alice } }); const { id } = await created.json() as any;
    const forbidden = await request('/sessions/' + id, 'bob'), invalid = await request('/sessions/' + id + '/turn', 'alice', { prompt: '' });
    const a = await request('/sessions/' + id + '/turn', 'alice', { prompt: 'Remember SESSION-MARKER-183.' }), first = await a.json() as any;
    const b = await request('/sessions/' + id + '/turn', 'alice', { prompt: 'Repeat the session marker.' }), second = await b.json() as any;
    return report({ unauthorized: unauthorized.status, crossTenant: forbidden.status, invalid: invalid.status, hostSession: id, first, second }, { authenticationRequired: unauthorized.status === 401, ownershipEnforced: forbidden.status === 404, validationEnforced: invalid.status === 422, realTurnsSucceeded: a.ok && b.ok, explicitResume: Boolean(first.sdkSessionId) && first.sdkSessionId === second.sdkSessionId, liveRecall: mode !== 'live' || String(second.answer).includes('SESSION-MARKER-183') }, { first, second }, 'Actual loopback REST requests with random ephemeral bearer tokens. In-memory ownership/history are a classroom service; use durable storage, TLS and your identity provider for deployment.');
  } finally { await api.close(); }
}
