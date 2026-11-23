import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const workspace = process.env.LAB_WORKSPACE!, memory = path.join(process.env.LAB_RUN!, 'auto-memory');
  await mkdir(memory, { recursive: true });
  const facts = { project: 'PROJECT_' + randomUUID(), memory: 'MEMORY_' + randomUUID(), history: 'HISTORY_' + randomUUID() };
  const projectFile = path.join(workspace, 'CLAUDE.md'), memoryFile = path.join(memory, 'MEMORY.md');
  await writeFile(projectFile, `# Classroom project instructions\nProject marker: ${facts.project}\n`);
  await writeFile(memoryFile, `# Classroom automatic memory\nMemory marker: ${facts.memory}\n`);
  const seed = await native(`Conversation-only classroom history marker: ${facts.history}.`, {
    settingSources: ['project'], settings: { autoMemoryEnabled: true, autoMemoryDirectory: memory },
  });
  const sessionId = requireNative(seed);
  const options = { settingSources: ['project'] as ('project')[],
    systemPrompt: { type: 'preset' as const, preset: 'claude_code' as const },
    tools: ['Read'], canUseTool: async (_name: string, input: Record<string, unknown>) => {
      const file = typeof input.file_path === 'string' ? path.resolve(input.file_path) : '';
      return [projectFile, memoryFile].includes(file)
        ? { behavior: 'allow' as const, updatedInput: input }
        : { behavior: 'deny' as const, message: 'Read only the owned instruction and memory files.' };
    }, settings: { autoMemoryEnabled: true, autoMemoryDirectory: memory } };
  const prompt = 'List the exact project marker from CLAUDE.md, memory marker from automatic memory, and history marker from earlier conversation. Use UNKNOWN for unavailable facts. Do not search other files.';
  const resumed = mode === 'live' ? await native(prompt, { ...options, resume: sessionId }, true) : null;
  const fresh = mode === 'live' ? await native(prompt, options, true) : null;
  if (resumed) requireNative(resumed, false); if (fresh) requireNative(fresh, false);
  const answer = (r: typeof resumed) => r?.events.findLast(e => e.type === 'result')?.result ?? '';
  return report({ facts, projectFile, memoryFile, resumedAnswer: answer(resumed), freshAnswer: answer(fresh) }, {
    projectInstructionsPersisted: (await readFile(projectFile, 'utf8')).includes(facts.project),
    automaticMemoryPersisted: (await readFile(memoryFile, 'utf8')).includes(facts.memory),
    threeDistinctStorageFacts: new Set(Object.values(facts)).size === 3,
    ...(mode === 'live' ? {
      resumedModelSeesAllThree: Object.values(facts).every(f => answer(resumed).includes(f)),
      freshModelSeesProjectAndMemory: answer(fresh).includes(facts.project) && answer(fresh).includes(facts.memory),
      freshModelLacksConversationFact: !answer(fresh).includes(facts.history),
    } : {}),
  }, { seed, resumed, fresh }, 'Three separate owned facts: CLAUDE.md instructions, explicitly seeded MEMORY.md, and a native conversation message. Live mode probes resumed and fresh model sessions. The memory file is a classroom fixture, not evidence that the model wrote memory automatically.');
}
