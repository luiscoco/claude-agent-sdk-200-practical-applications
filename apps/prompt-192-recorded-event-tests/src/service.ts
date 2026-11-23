import express from 'express';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { native, requireNative } from './native.js';
type Session = { id: string; owner: string; sdkId?: string; history: Array<{ prompt: string; answer: string | null }> };
export async function service(infer: boolean) {
  const tokens = { alice: randomBytes(24).toString('hex'), bob: randomBytes(24).toString('hex') };
  const sessions = new Map<string, Session>(), app = express(); app.use(express.json({ limit: '4kb' }));
  app.use((req, res, next) => {
    const bearer = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const owner = Object.entries(tokens).find(([, token]) => bearer.length === token.length && timingSafeEqual(Buffer.from(token), Buffer.from(bearer)))?.[0];
    if (!owner) { res.status(401).json({ error: 'Authentication required.' }); return; }
    res.locals.owner = owner; next();
  });
  app.post('/sessions', (_req, res) => { const value: Session = { id: randomUUID(), owner: res.locals.owner, history: [] }; sessions.set(value.id, value); res.status(201).json({ id: value.id }); });
  app.get('/sessions/:id', (req, res) => { const value = sessions.get(String(req.params.id)); if (!value || value.owner !== res.locals.owner) { res.status(404).end(); return; } res.json(value); });
  app.post('/sessions/:id/turn', async (req, res) => {
    const value = sessions.get(String(req.params.id)); if (!value || value.owner !== res.locals.owner) { res.status(404).end(); return; }
    if (typeof req.body?.prompt !== 'string' || !req.body.prompt.trim() || req.body.prompt.length > 2000) { res.status(422).json({ error: 'Provide a prompt of 1–2000 characters.' }); return; }
    try {
      const observed = await native(req.body.prompt, value.sdkId ? { resume: value.sdkId } : {}, infer);
      value.sdkId = requireNative(observed, !infer);
      const answer = infer ? observed.events.findLast(e => e.type === 'result')?.result ?? null : null;
      value.history.push({ prompt: req.body.prompt, answer });
      res.json({ sessionId: value.id, sdkSessionId: value.sdkId, answer, mode: infer ? 'live' : 'transcript-only', observed });
    } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : String(error) }); }
  });
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Service failed to bind.');
  return { endpoint: `http://127.0.0.1:${address.port}`, tokens, sessions,
    close: async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
