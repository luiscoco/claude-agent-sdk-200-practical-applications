import { fixture, agentOptions, agentCalls, taskEvents, answer } from './agents.js';
import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export function concurrencyTrace(events: any[]) {
  const active = new Set<string>(); let peak = 0;
  for (const e of events) {
    if (e.subtype === 'task_started') active.add(e.task_id);
    if (e.subtype === 'task_notification') active.delete(e.task_id);
    peak = Math.max(peak, active.size);
  }
  return peak;
}
export async function run(mode: string) {
  await fixture(); const options = agentOptions(), discovery = await inspect(options);
  const live = mode === 'live' ? await native('Launch researcher and reviewer concurrently on queue-design.txt. They are independent analyses: one extracts facts, the other reviews safeguards. Wait for both and combine their results with record IDs.', options, true) : null;
  if (live) requireNative(live, false);
  const lifecycle = live ? taskEvents(live.events) : [], peak = concurrencyTrace(lifecycle);
  return report({ lifecycle, observedPeakTasks: peak, answer: live ? answer(live.events) : null }, {
    localDiscoveryCompleted: discovery.result.num_turns === 0,
    ...(live ? { bothIndependentTasksInvoked: new Set(agentCalls(live.events).map(b => b.input.subagent_type)).size >= 2,
      actualExecutionOverlapObserved: peak >= 2, finalAnswerUsesBothAnalyses: /Q2/.test(answer(live.events)) && /Q3/.test(answer(live.events)) } : {}),
  }, { discovery, live }, 'Actual lifecycle ordering establishes task overlap. A batched pair of Agent calls without observed overlapping task lifetimes is not labelled concurrent execution.');
}
