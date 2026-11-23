import { createServer } from 'node:http';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  let blockedHits = 0; const servers: ReturnType<typeof createServer>[] = [];
  async function listen(blocked: boolean) { const server = createServer((_req, res) => { if (blocked) blockedHits++; res.end('owned-response'); }); servers.push(server); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${(server.address() as any).port}/`; }
  const allowed = await listen(false), forbidden = await listen(true);
  async function controlledFetch(url: string) { if (url !== allowed) throw new Error('Outbound destination denied before network access.'); return (await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) })).text(); }
  try {
    let denied = false; try { await controlledFetch(forbidden); } catch { denied = true; }
    const evidence = await exercise(mode, 'Use the controlled network tool and report the allowed response.', controlledFetch, allowed);
    return report({ allowedResponse: evidence.local, denied, blockedTargetHits: blockedHits }, { allowedRequestSucceeded: evidence.local === 'owned-response', blockedBeforeDispatch: denied && blockedHits === 0 }, evidence, 'Application URL allowlist proxy with redirects disabled. Arbitrary agent tools are disabled. This does not claim OS-level egress filtering; deploy network policy separately.');
  } finally { for (const server of servers) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } }
}
