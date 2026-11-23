import { query, type Options, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'node:crypto';
/** Actual discovery/control requests with a held-open, transcript-only input stream. */
export async function inspect(options: Options = {}, operation?: (runtime: Query) => Promise<unknown>) {
  const events: any[] = [];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  async function* input(): AsyncGenerator<SDKUserMessage> {
    yield { type: 'user', uuid: randomUUID(), message: { role: 'user', content: 'Owned classroom capability inspection; no inference requested.' },
      parent_tool_use_id: null, shouldQuery: false };
    await held;
  }
  const abortController = new AbortController(), timer = setTimeout(() => abortController.abort(), 60000);
  const runtime = query({ prompt: input(), options: { cwd: process.env.LAB_WORKSPACE, tools: [],
    settingSources: [], strictMcpConfig: true, model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    persistSession: true, env: { ...process.env }, ...options, abortController } });
  let pumpError: unknown;
  const pump = (async () => { try { for await (const event of runtime) events.push(event); } catch (error) { pumpError = error; } })();
  try {
    const initialized = await runtime.initializationResult();
    const agents = await runtime.supportedAgents(), commands = await runtime.supportedCommands();
    const change = operation ? await operation(runtime) : null;
    release(); await pump;
    if (pumpError) throw pumpError;
    const init = events.find(e => e.type === 'system' && e.subtype === 'init');
    const result = events.findLast(e => e.type === 'result');
    if (!result || result.is_error || result.subtype !== 'success' || result.num_turns !== 0 || result.total_cost_usd !== 0)
      throw new Error('Capability discovery did not complete as a zero-turn local operation.');
    return { agents, commands, change, init, initialized: {
      commands: initialized.commands, agents: initialized.agents,
      plugins: (initialized as any).plugins, pluginsApplied: (initialized as any).plugins_applied,
    }, result, events };
  } finally { release(); clearTimeout(timer); runtime.close(); await pump; }
}
export function hasName(items: any[], name: string) {
  return items.some(item => [item.name, item.agentType, item.type, item.slug].includes(name));
}
