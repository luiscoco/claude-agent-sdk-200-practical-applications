import { specialists, fixture, agentOptions, agentCalls, answer, taskEvents } from './agents.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const file = await fixture(), options = agentOptions();
  const discovery = await inspect(options);
  const live = mode === 'live' ? await native(`Use researcher to extract facts from ${file}, then use reviewer to critique that same design. Return separate FACTS and REVIEW sections with record IDs.`, options, true) : null;
  if (live) requireNative(live, false);
  const invoked = live ? agentCalls(live.events).map(b => b.input.subagent_type) : [];
  return report({ definitions: specialists, discovered: discovery.agents, answer: live ? answer(live.events) : null,
    invoked, lifecycle: live ? taskEvents(live.events) : [] }, {
    researchAndReviewDiscovered: ['researcher', 'reviewer'].every(name => hasName(discovery.agents, name)),
    distinctResponsibilities: specialists.researcher.prompt !== specialists.reviewer.prompt,
    ...(live ? { bothSpecialistsActuallyInvoked: ['researcher', 'reviewer'].every(name => invoked.includes(name)),
      answerCitesOwnedFacts: /Q2/.test(answer(live.events)) && /Q3/.test(answer(live.events)) } : {}),
  }, { discovery, live }, 'Local mode verifies native specialist discovery. Live mode invokes both specialists and verifies actual Agent calls and citations. The document is an owned synthetic queue design.');
}
