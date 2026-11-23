import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { owned, MemoryStore, cleanEnvironment } from './application.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const root = process.env.LAB_WORKSPACE!, memory = new MemoryStore(path.join(root, 'memory'));
  await memory.put('alice', 'preference', 'ALICE-private'); await memory.put('bob', 'preference', 'BOB-private');
  let escaped = false; try { owned(root, '../bob'); } catch { escaped = true; }
  const runs = [];
  for (const tenant of ['alice', 'bob']) {
    const cwd = owned(root, tenant); await mkdir(cwd, { recursive: true });
    const items = await memory.list(tenant), env = cleanEnvironment(cwd, mode === 'live' && process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {});
    const observed = await native(`State only this tenant's preference: ${items[0].text}`, { cwd, env }, mode === 'live'); requireNative(observed, mode !== 'live'); runs.push({ tenant, observed });
  }
  return report({ tenants: runs.map(r => ({ tenant: r.tenant, session: r.observed.sessionId })), credentialRouting: 'Only explicit model credential forwarded; service credentials excluded.' }, { pathTraversalDenied: escaped, memorySeparated: (await memory.list('alice'))[0].text !== (await memory.list('bob'))[0].text, sessionsDistinct: runs[0].observed.sessionId !== runs[1].observed.sessionId }, runs, 'Owned workspace/config/memory/session separation; this is not an OS security boundary. Authenticate and authorize tenant selection before using these helpers.');
}
