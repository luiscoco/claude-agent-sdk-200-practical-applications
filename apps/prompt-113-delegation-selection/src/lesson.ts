import { fixture, agentOptions, agentCalls, answer } from './agents.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  await fixture(); const options = agentOptions(), discovery = await inspect(options);
  const automatic = mode === 'live' ? await native('Independently review queue-design.txt for missing retry safeguards. Choose the suitable specialist based on its description, delegate the work, and cite record IDs.', options, true) : null;
  const explicit = mode === 'live' ? await native('Use the reviewer agent specifically to review queue-design.txt. Cite record IDs.', options, true) : null;
  for (const result of [automatic, explicit]) if (result) requireNative(result, false);
  const calls = (r: typeof explicit) => r ? agentCalls(r.events).map(b => b.input.subagent_type) : [];
  return report({ automaticSelection: calls(automatic), explicitSelection: calls(explicit),
    automaticAnswer: automatic ? answer(automatic.events) : null, explicitAnswer: explicit ? answer(explicit.events) : null }, {
    suitableSpecialistDiscovered: hasName(discovery.agents, 'reviewer'),
    ...(automatic && explicit ? { automaticDelegationActuallyObserved: calls(automatic).includes('reviewer'),
      namedInvocationActuallyObserved: calls(explicit).includes('reviewer') } : {}),
  }, { discovery, automatic, explicit }, 'Automatic selection is prompted by responsibility without naming the specialist. The explicit control names reviewer. Neither case counts a parent-only answer as delegation.');
}
