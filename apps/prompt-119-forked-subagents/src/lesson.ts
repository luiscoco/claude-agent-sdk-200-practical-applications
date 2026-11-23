import { randomUUID } from 'node:crypto';
import { agentOptions, agentCalls, answer } from './agents.js';
import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const options = agentOptions({ fresh: { description: 'Answer only from this delegated prompt, without parent history.', prompt: 'Return UNKNOWN if the classroom marker is absent from your context.', tools: [] } });
  const discovery = await inspect(options), marker = 'PARENT_' + randomUUID();
  let seed = null, fresh = null, fork = null;
  if (mode === 'live') {
    seed = await native(`Remember this owned classroom marker in the parent conversation: ${marker}. Reply OK.`, {}, true);
    const id = requireNative(seed, false);
    const prompt = 'Ask the specialist for the exact earlier classroom marker. Do not include the marker value in the Agent prompt. Relay its answer only.';
    fresh = await native('Use fresh. ' + prompt, { ...options, resume: id }, true); requireNative(fresh, false);
    fork = await native('Use Agent with subagent_type fork so it inherits the parent conversation. ' + prompt, { ...options, resume: id }, true); requireNative(fork, false);
  }
  const freshCalls = fresh ? agentCalls(fresh.events) : [], forkCalls = fork ? agentCalls(fork.events) : [];
  return report({ nativeVersion: discovery.init?.claude_code_version, freshAnswer: fresh ? answer(fresh.events) : null, forkAnswer: fork ? answer(fork.events) : null }, {
    actualRuntimeVersionCaptured: Boolean(discovery.init?.claude_code_version),
    ...(fresh && fork ? { freshSpecialistInvokedWithoutLeakedFact: freshCalls.some(b => b.input.subagent_type === 'fresh') && freshCalls.every(b => !b.input.prompt?.includes(marker)),
      freshDoesNotKnowParentMarker: !answer(fresh.events).includes(marker),
      actualForkInvokedWithoutLeakedFact: forkCalls.some(b => b.input.subagent_type === 'fork') && forkCalls.every(b => !b.input.prompt?.includes(marker)),
      forkInheritsExactParentFact: answer(fork.events).trim() === marker } : {}),
  }, { discovery, seed, fresh, fork }, 'Forked subagents are distinct from forking the entire query session. The live experiment requires actual Agent subagent_type:fork and rejects prompt leakage of the random parent fact into either delegated prompt.');
}
