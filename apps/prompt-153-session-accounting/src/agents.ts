import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentDefinition, Options } from '@anthropic-ai/claude-agent-sdk';
export const specialists: Record<string, AgentDefinition> = {
  researcher: { description: 'Extract exact facts from the owned queue-design document; cite its record IDs.',
    prompt: 'Research only the provided owned requirements. Return FACTS with exact record IDs. Do not critique.', tools: ['Read'], maxTurns: 3, model: 'inherit' },
  reviewer: { description: 'Review a queue design for missing safeguards, especially idempotency and retry limits.',
    prompt: 'Review only the supplied design. Return REVIEW with concrete missing safeguards and record IDs. Do not invent facts.', tools: ['Read'], maxTurns: 3, model: 'inherit' },
};
export async function fixture() {
  const file = path.join(process.env.LAB_WORKSPACE!, 'queue-design.txt');
  await writeFile(file, 'Q1: Queue jobs retry on failure.\nQ2: No idempotency key is stored.\nQ3: Retry count has no upper bound.\nQ4: Worker concurrency is two.\n');
  return file;
}
export function agentOptions(agents: Record<string, AgentDefinition> = specialists): Options {
  return { agents, tools: ['Agent', 'Read'], maxTurns: 10, forwardSubagentText: true,
    env: { ...process.env, CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '1', CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '2' },
    canUseTool: async (name, input) => {
      if (name === 'Agent') return { behavior: 'allow', updatedInput: input };
      const file = typeof input.file_path === 'string' ? path.resolve(input.file_path) : '';
      return name === 'Read' && file === path.join(process.env.LAB_WORKSPACE!, 'queue-design.txt')
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny', message: 'Use only the owned queue-design document and configured specialists.' };
    } };
}
export function agentCalls(events: any[]) {
  return events.flatMap(e => e.type === 'assistant' && Array.isArray(e.message?.content)
    ? e.message.content.filter((b: any) => b.type === 'tool_use' && ['Agent', 'Task'].includes(b.name)) : []);
}
export function answer(events: any[]) { return events.findLast(e => e.type === 'result')?.result ?? ''; }
export function taskEvents(events: any[]) { return events.filter(e => e.type === 'system' && ['task_started', 'task_notification', 'task_progress', 'task_updated'].includes(e.subtype)); }
export async function writeAgent(name: string, body: string) {
  const directory = path.join(process.env.LAB_WORKSPACE!, '.claude/agents'); await mkdir(directory, { recursive: true });
  const file = path.join(directory, name + '.md'); await writeFile(file, body); return file;
}
