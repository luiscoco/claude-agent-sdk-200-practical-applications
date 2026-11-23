import { writeAgent, fixture, agentOptions, agentCalls, answer } from './agents.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const file = await writeAgent('queue-auditor', '---\nname: queue-auditor\ndescription: Inspect owned queue designs for unsafe retries.\ntools: Read\nmodel: inherit\n---\nRead the owned queue-design.txt. Report the exact risky record IDs.');
  await fixture();
  const options = { ...agentOptions({}), settingSources: ['project'] as ('project')[] };
  const discovered = await inspect(options), disabled = await inspect({ ...options, settingSources: [] });
  const live = mode === 'live' ? await native('Use the queue-auditor specialist to inspect queue-design.txt and report risky record IDs.', options, true) : null;
  if (live) requireNative(live, false);
  return report({ definitionFile: file, enabledAgents: discovered.agents, disabledAgents: disabled.agents,
    answer: live ? answer(live.events) : null }, {
    actualProjectAgentDiscovered: hasName(discovered.agents, 'queue-auditor'),
    settingsSourceControlExcludesProjectAgent: !hasName(disabled.agents, 'queue-auditor'),
    ...(live ? { actualFilesystemAgentInvoked: agentCalls(live.events).some(b => b.input.subagent_type === 'queue-auditor'),
      liveAuditFindsMissingIdempotency: /Q2/.test(answer(live.events)) } : {}),
  }, { discovered, disabled, live }, 'The definition is written into a fresh owned .claude/agents directory. Native discovery is compared with project settings enabled and excluded. Live mode verifies invocation, not merely file existence.');
}
