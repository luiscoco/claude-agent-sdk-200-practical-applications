import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
/** Owned JSON-RPC stdio fixture for the 2026 MCP task response contract. */
export async function taskServer() {
  const directory = path.join(process.env.LAB_WORKSPACE!, 'task-server'); await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'server.mjs');
  await writeFile(file, `import readline from 'node:readline';
import { randomUUID } from 'node:crypto';
const tasks = new Map();
function state(id) { const t = tasks.get(id); if (!t) throw new Error('Unknown task'); const elapsed = Date.now() - t.start; return { resultType: 'complete', taskId: id, status: t.cancelled ? 'cancelled' : elapsed >= 2000 ? 'completed' : 'working', createdAt: t.createdAt, lastUpdatedAt: new Date().toISOString(), ttlMs: 3600000, pollIntervalMs: 250, statusMessage: t.cancelled ? 'Cancelled by classroom client' : elapsed >= 2000 ? 'Report ready' : 'Computing report', ...(elapsed >= 2000 && !t.cancelled ? { result: { content: [{ type: 'text', text: 'TASK_REPORT_COMPLETE' }] } } : {}) }; }
async function handle(message) {
  if (message.method === 'initialize') return { protocolVersion: message.params.protocolVersion, capabilities: { tools: {}, tasks: { requests: { tools: { call: {} } } } }, serverInfo: { name: 'owned-task-server', version: '1.0.0' } };
  if (message.method === 'ping') return {};
  if (message.method === 'tools/list') return { tools: [{ name: 'build_report', description: 'Start an owned report computation as a server task.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execution: { taskSupport: 'required' } }] };
  if (message.method === 'tools/call') { const taskId = 'owned-' + randomUUID(); const createdAt = new Date().toISOString(); tasks.set(taskId, { start: Date.now(), createdAt, cancelled: false }); return { ...state(taskId), resultType: 'task' }; }
  if (message.method === 'tasks/get') return state(message.params.taskId);
  if (message.method === 'tasks/cancel') { const t = tasks.get(message.params.taskId); if (!t) throw new Error('Unknown task'); t.cancelled = true; return state(message.params.taskId); }
  throw new Error('Unsupported method');
}
const input = readline.createInterface({ input: process.stdin });
input.on('line', async line => { let message; try { message = JSON.parse(line); if (message.id === undefined) return; const result = await handle(message); process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) + '\\n'); } catch (error) { if (message?.id !== undefined) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32602, message: error.message } }) + '\\n'); } });
`);
  return { type: 'stdio' as const, command: process.execPath, args: [file] };
}
