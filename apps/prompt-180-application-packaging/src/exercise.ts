import { native, requireNative } from './native.js';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { spawn } from 'node:child_process';
export async function child(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; pid?: number }>((resolve, reject) => {
    const processChild = spawn(process.execPath, args, { ...options, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; const deadline = setTimeout(() => processChild.kill(), 180000);
    processChild.stdout.on('data', data => stdout += data); processChild.stderr.on('data', data => stderr += data);
    processChild.once('error', error => { clearTimeout(deadline); reject(error); });
    processChild.once('close', code => { clearTimeout(deadline); resolve({ code, stdout, stderr, pid: processChild.pid }); });
  });
}
/** Local mode tests the same handler directly. Live mode requires a real observed tool invocation. */
export async function exercise(mode: string, task: string, handler: (input: string) => Promise<unknown>, input: string) {
  const calls: Array<{ input: string; output: unknown }> = [];
  const invoke = async (value: string) => { const output = await handler(value); calls.push({ input: value, output }); return output; };
  const local = await invoke(input); calls.length = 0;
  const sdk = createSdkMcpServer({ name: 'classroom', tools: [tool('inspect', 'Inspect the owned application fixture. Supply the requested input.', { input: z.string().max(2000) }, async args => ({ content: [{ type: 'text', text: JSON.stringify(await invoke(args.input)) }] }))] });
  const observed = await native(mode === 'live' ? `${task}\nYou MUST call mcp__classroom__inspect with input ${JSON.stringify(input)} and cite its actual output. Do not invent results.` : 'Record an owned application contract check without inference.',
    mode === 'live' ? { mcpServers: { classroom: sdk }, allowedTools: ['mcp__classroom__inspect'] } : {}, mode === 'live');
  requireNative(observed, mode !== 'live');
  if (mode === 'live' && !calls.length) throw new Error('No actual application tool call was observed.');
  return { local, calls, observed };
}
