import { randomUUID } from 'node:crypto';
import { agentOptions, agentCalls, taskEvents, answer } from './agents.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const marker = 'SPECIALIST_' + randomUUID();
  const agents = { rememberer: { description: 'Remember an owned classroom marker across resumed specialist work.', prompt: 'Retain exact classroom facts. Return only the requested fact.', tools: [], maxTurns: 2 } };
  const options = agentOptions(agents), discovery = await inspect(options);
  let first = null, second = null, agentId: string | undefined;
  if (mode === 'live') {
    first = await native(`Use rememberer to retain the owned classroom marker ${marker}. Ask it to acknowledge the marker and finish.`, options, true);
    const sessionId = requireNative(first, false);
    agentId = taskEvents(first.events).find(e => e.subtype === 'task_started' && e.subagent_type === 'rememberer')?.task_id;
    if (!agentId) throw new Error('No native rememberer task ID was captured.');
    second = await native(`Use SendMessage addressed to the existing rememberer agent ID ${agentId} to continue its work; do not start a new specialist. Ask it for the earlier owned classroom marker and return only that marker.`, {
      ...options, resume: sessionId, tools: ['Agent', 'SendMessage'],
      canUseTool: async (name, input) => name === 'SendMessage' && input.to === agentId
        ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Continue only the exact captured owned specialist; do not spawn a replacement.' },
    }, true);
    requireNative(second, false);
  }
  return report({ agentId, firstSession: first?.sessionId, resumedSession: second?.sessionId, answer: second ? answer(second.events) : null }, {
    resumableSpecialistDiscovered: hasName(discovery.agents, 'rememberer'),
    ...(first && second ? { parentSessionExplicitlyResumed: second.sessionId === first.sessionId,
      stableTaskIdResumed: taskEvents(second.events).some(e => e.subtype === 'task_started' && e.task_id === agentId),
      resumeMessageDoesNotLeakOriginalMarker: second.events.flatMap(e => e.type === 'assistant' ? e.message?.content ?? [] : [])
        .filter((b: any) => b.type === 'tool_use' && b.name === 'SendMessage').every((b: any) => !JSON.stringify(b.input).includes(marker)),
      actualSpecialistRetainsExactFact: answer(second.events).trim() === marker } : {}),
  }, { discovery, first, second }, 'Live mode captures a native task ID, resumes the same parent conversation, and asks to resume that specialist. Exact marker recall and a stable task ID are both required; a new agent with the answer repeated in its prompt is not counted.');
}
