import { createServer } from 'node:http';
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'node:crypto';
export async function streamService(infer: boolean) {
  const active = new Map<string, AbortController>();
  const server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url?.startsWith('/cancel/')) { const id = req.url.slice(8); const controller = active.get(id); if (!controller) { res.writeHead(404).end(); return; } controller.abort(); res.writeHead(202).end(); return; }
    if (req.url !== '/events') { res.writeHead(404).end(); return; }
    const id = randomUUID(), controller = new AbortController(); active.set(id, controller);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const send = (event: string, data: unknown) => { if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    send('started', { id }); res.on('close', () => controller.abort());
    async function* prompts(): AsyncGenerator<SDKUserMessage> { yield { type: 'user', uuid: randomUUID(), message: { role: 'user', content: 'Explain one queue safeguard briefly.' }, parent_tool_use_id: null, shouldQuery: infer }; }
    const run = query({ prompt: prompts(), options: { cwd: process.env.LAB_WORKSPACE, tools: [], settingSources: [], strictMcpConfig: true, env: { ...process.env },
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6', maxTurns: 3, maxBudgetUsd: 0.35, includePartialMessages: true, abortController: controller } });
    let resultSeen = false;
    try { for await (const event of run) { send('sdk', event); if (event.type === 'result') resultSeen = true; } }
    catch (error) { send(controller.signal.aborted ? 'cancelled' : 'error', { message: controller.signal.aborted ? 'Request cancelled.' : error instanceof Error ? error.message : String(error) }); }
    finally { run.close(); active.delete(id); send('done', { id, resultSeen, cancelled: controller.signal.aborted }); res.end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Streaming service failed to bind.');
  return { endpoint: `http://127.0.0.1:${address.port}`, active,
    close: async () => { for (const controller of active.values()) controller.abort(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
export function parseSse(text: string) { return text.split('\n\n').filter(Boolean).map(packet => ({ event: /^event: (.+)$/m.exec(packet)?.[1], data: JSON.parse(/^data: (.+)$/m.exec(packet)?.[1] || 'null') })); }
