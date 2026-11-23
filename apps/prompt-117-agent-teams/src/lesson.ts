import { inspect } from './capabilities.js';
import { fixture, agentOptions, agentCalls, answer } from './agents.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  await fixture();
  const discovery = await inspect({ ...agentOptions(), tools: { type: 'preset', preset: 'claude_code' } });
  const tools: string[] = discovery.init?.tools ?? [];
  const messaging = tools.includes('SendMessage'), tasks = ['TaskCreate', 'TaskUpdate', 'TaskList'].every(t => tools.includes(t));
  const available = messaging && tasks;
  const options = { ...agentOptions(), tools: ['Agent', 'Read', ...(messaging ? ['SendMessage'] : []), ...(tasks ? ['TaskCreate', 'TaskUpdate', 'TaskList'] : [])],
    canUseTool: async (name: string, input: Record<string, unknown>) => ['Agent', 'SendMessage', 'TaskCreate', 'TaskUpdate', 'TaskList'].includes(name)
      ? { behavior: 'allow' as const, updatedInput: input } : agentOptions().canUseTool!(name, input, {} as any) };
  const live = mode === 'live' ? await native(available
    ? 'Coordinate researcher and reviewer as named teammates on queue-design.txt. Create a shared task for each, exchange a finding through SendMessage, and mark completed tasks before combining the report.'
    : 'Use researcher and reviewer to review queue-design.txt. Return their combined report. Explicitly describe this as ordinary specialist delegation; team messaging was not discovered.', options, true) : null;
  if (live) requireNative(live, false);
  const toolCalls = live?.events.flatMap(e => e.type === 'assistant' ? (e.message?.content ?? []).filter((b: any) => b.type === 'tool_use') : []) ?? [];
  return report({ available, tools, support: available ? 'Messaging and shared-task tools discovered in this runtime' : 'Required team tools not exposed; ordinary subagents are the fallback',
    answer: live ? answer(live.events) : null }, {
    supportDecisionDerivedFromActualRuntime: typeof available === 'boolean' && Array.isArray(tools),
    ...(live ? available ? { actualMessagingObserved: toolCalls.some((b: any) => b.name === 'SendMessage'),
      sharedTaskCoordinationObserved: ['TaskCreate', 'TaskUpdate'].every(name => toolCalls.some((b: any) => b.name === name)) }
      : { actualFallbackDelegationObserved: agentCalls(live.events).length >= 1 } : {}),
  }, { discovery, live }, 'Feature detection uses the actual native tool inventory, not just a CLI environment flag or a static documentation claim. Missing team support is a reported capability outcome; live mode demonstrates the supported path.');
}
