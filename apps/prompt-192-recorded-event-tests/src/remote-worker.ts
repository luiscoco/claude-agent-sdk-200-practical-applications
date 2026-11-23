import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { native, requireNative } from './native.js';
import { FileSessionStore } from './store.js';
import { prepareAuth } from './auth.js';
const input = JSON.parse(process.argv[2]);
await mkdir(process.env.LAB_WORKSPACE!, { recursive: true });
if (input.live) await prepareAuth(process.env.CLAUDE_CONFIG_DIR!);
const store = new FileSessionStore(input.storeDirectory);
const result = await native(input.text, { sessionStore: store, ...(input.sessionId ? { resume: input.sessionId } : {}),
  ...(input.live ? { tools: ['Read'], canUseTool: async (_name: string, toolInput: Record<string, unknown>) =>
    typeof toolInput.file_path === 'string' && path.resolve(toolInput.file_path) === path.join(process.env.LAB_WORKSPACE!, 'requirements.txt')
      ? { behavior: 'allow' as const, updatedInput: toolInput }
      : { behavior: 'deny' as const, message: 'Read only this worker’s owned requirements.txt.' } } : {}),
}, Boolean(input.live));
requireNative(result, !input.live);
console.log(JSON.stringify({ pid: process.pid, config: process.env.CLAUDE_CONFIG_DIR,
  workspace: process.env.LAB_WORKSPACE, result }));
