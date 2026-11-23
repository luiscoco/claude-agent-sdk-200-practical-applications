import express from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { query } from '@anthropic-ai/claude-agent-sdk';
type Chat = { id: string; sdkId?: string; history: any[]; busy: boolean; controller?: AbortController; approve?: (allow: boolean) => void };
export function installChat(app: ReturnType<typeof express>, directory: string) {
  const chats = new Map<string, Chat>();
  app.use('/chat-api', (req, res, next) => {
    let id = /(?:^|;\s*)classroom_chat=([a-f0-9-]+)/.exec(req.headers.cookie || '')?.[1];
    if (!id || !chats.has(id)) { id = randomUUID(); chats.set(id, { id, history: [], busy: false }); res.cookie('classroom_chat', id, { httpOnly: true, sameSite: 'strict', path: '/' }); }
    res.locals.chat = chats.get(id); next();
  });
  app.get('/chat-api/history', (_req, res) => { const chat: Chat = res.locals.chat; res.json({ session: chat.id, sdkSession: chat.sdkId, history: chat.history, busy: chat.busy }); });
  app.post('/chat-api/cancel', (_req, res) => { const chat: Chat = res.locals.chat; chat.controller?.abort(); chat.approve?.(false); res.json({ cancellationRequested: chat.busy }); });
  app.post('/chat-api/approve', (req, res) => { const chat: Chat = res.locals.chat; if (!chat.approve || typeof req.body?.allow !== 'boolean') { res.status(409).end(); return; } chat.approve(req.body.allow); chat.approve = undefined; res.json({ accepted: true }); });
  app.post('/chat-api/turn', async (req, res) => {
    const chat: Chat = res.locals.chat;
    if (chat.busy) { res.status(409).end(); return; }
    if (typeof req.body?.prompt !== 'string' || !req.body.prompt.trim() || req.body.prompt.length > 2000 || !['local', 'live'].includes(req.body.mode)) { res.status(422).end(); return; }
    const live = req.body.mode === 'live', prompt = req.body.prompt, cwd = path.join(directory, chat.id); await mkdir(cwd, { recursive: true });
    chat.busy = true; const controller = new AbortController(); chat.controller = controller;
    const timer = setTimeout(() => controller.abort(), 180000);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    const send = (event: string, data: any) => { if (!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
    const onClose = () => controller.abort(); res.on('close', onClose);
    async function* inputs(): AsyncGenerator<any> { yield { type: 'user', uuid: randomUUID(), message: { role: 'user', content: prompt }, parent_tool_use_id: null, shouldQuery: live }; }
    const runtime = query({ prompt: inputs(), options: { cwd, resume: chat.sdkId, env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(cwd, 'config') }, tools: live ? ['Write'] : [], settingSources: [], strictMcpConfig: true, model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6', maxTurns: 4, maxBudgetUsd: 0.75, includePartialMessages: true, abortController: controller,
      canUseTool: async (name, input) => {
        if (name !== 'Write' || typeof input.file_path !== 'string' || path.resolve(input.file_path) !== path.join(cwd, 'note.txt')) return { behavior: 'deny', message: 'Only note.txt in this chat workspace is permitted.' };
        send('approval', { tool: name, input, message: 'Allow writing this chat’s note.txt?' });
        const allow = await new Promise<boolean>(resolve => { const deadline = setTimeout(() => { chat.approve = undefined; resolve(false); }, 30000); chat.approve = value => { clearTimeout(deadline); resolve(value); }; controller.signal.addEventListener('abort', () => { clearTimeout(deadline); resolve(false); }, { once: true }); });
        return allow ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'User denied or approval expired.' };
      } } });
    const turn: any = { prompt, mode: req.body.mode, events: [] }; chat.history.push(turn);
    try { for await (const event of runtime) { turn.events.push(event); if (event.type === 'system' && event.subtype === 'init') chat.sdkId = event.session_id; send('sdk', event); } }
    catch (error) { turn.error = controller.signal.aborted ? 'Cancelled' : error instanceof Error ? error.message : String(error); send('error', { message: turn.error }); }
    finally { runtime.close(); clearTimeout(timer); chat.approve?.(false); chat.approve = undefined; chat.busy = false; res.off('close', onClose); send('done', { cancelled: controller.signal.aborted, mode: live ? 'live' : 'transcript-only' }); res.end(); }
  });
  return chats;
}
