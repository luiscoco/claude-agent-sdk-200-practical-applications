import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const memory = path.join(process.env.LAB_RUN!, 'owned-auto-memory');
  await mkdir(memory, { recursive: true });
  const marker = 'MEMORY_' + randomUUID(), memoryFile = path.join(memory, 'MEMORY.md');
  await writeFile(memoryFile, `# Persistent classroom memory\nRemember this marker: ${marker}\n`);
  const common = { systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const },
    tools: ['Read', 'Write', 'Edit'],
    canUseTool: async (_name: string, input: Record<string, unknown>) => {
      const file = typeof input.file_path === 'string' ? path.resolve(input.file_path) : '';
      const relative = path.relative(memory, file);
      return file && relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)
        ? { behavior: 'allow' as const, updatedInput: input }
        : { behavior: 'deny' as const, message: 'This lesson only permits the owned automatic-memory directory.' };
    },
  };
  const before = await readFile(memoryFile, 'utf8');
  const prompt = 'What is the persistent classroom memory marker? Return it exactly if loaded in your automatic memory; otherwise output UNKNOWN. Do not call file tools to search for it.';
  const enabled = mode === 'live' ? await native(prompt, { ...common, settings: { autoMemoryEnabled: true, autoMemoryDirectory: memory } }, true) : null;
  const disabled = mode === 'live' ? await native(prompt, { ...common, settings: { autoMemoryEnabled: false, autoMemoryDirectory: memory } }, true) : null;
  const enabledAgain = mode === 'live' ? await native(prompt, { ...common, settings: { autoMemoryEnabled: true, autoMemoryDirectory: memory } }, true) : null;
  for (const item of [enabled, disabled, enabledAgain]) if (item) requireNative(item, false);
  const answer = (r: typeof enabled) => r?.events.findLast(e => e.type === 'result')?.result ?? '';
  return report({ memoryDirectory: memory, marker, enabledAnswer: answer(enabled), disabledAnswer: answer(disabled), reenabledAnswer: answer(enabledAgain),
    toolRequirements: { reading: ['Read'], modelWrites: ['Write', 'Edit'], enabledForLiveScenario: common.tools } }, {
    disableDoesNotDeleteOwnedMemory: (await readFile(memoryFile, 'utf8')) === before,
    ...(mode === 'live' ? {
      enabledModelReadsMemory: answer(enabled).includes(marker),
      disabledModelDoesNotReceiveMemory: !answer(disabled).includes(marker),
      reenabledFreshSessionReadsPersistedMemory: answer(enabledAgain).includes(marker),
    } : {}),
  }, { enabled, disabled, enabledAgain }, 'Explicit per-invocation autoMemoryEnabled and autoMemoryDirectory settings with fresh sessions and a seeded owned memory file. Live calls compare enabled, disabled and reenabled behavior. Read/Write/Edit are available only within the classroom memory location; the scenario measures loading, not autonomous memory creation.');
}
