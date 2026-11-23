import { fixture, specialists, agentOptions, taskEvents, answer } from './agents.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  await fixture();
  const foreground = { ...specialists.reviewer, background: false }, background = { ...specialists.reviewer, background: true };
  const discovery = await inspect(agentOptions({ foreground, background }));
  const wait = mode === 'live' ? await native('Use foreground to review queue-design.txt. Wait for its report before producing the final answer.', agentOptions({ foreground }), true) : null;
  const asyncRun = mode === 'live' ? await native('Launch background to review queue-design.txt, inspect the task status while it works, and wait for completion before reporting its findings.', agentOptions({ background }), true) : null;
  for (const result of [wait, asyncRun]) if (result) requireNative(result, false);
  const events = (r: typeof wait) => r ? taskEvents(r.events) : [];
  return report({ foreground: events(wait), background: events(asyncRun),
    foregroundAnswer: wait ? answer(wait.events) : null, backgroundAnswer: asyncRun ? answer(asyncRun.events) : null }, {
    bothModesDiscovered: ['foreground', 'background'].every(n => hasName(discovery.agents, n)),
    ...(wait && asyncRun ? { foregroundObserved: events(wait).some(e => e.subtype === 'task_started' && e.is_backgrounded === false),
      backgroundObserved: events(asyncRun).some(e => e.subtype === 'task_started' && e.is_backgrounded === true),
      backgroundCompletionObserved: events(asyncRun).some(e => e.subtype === 'task_notification' && e.status === 'completed') } : {}),
  }, { discovery, wait, asyncRun }, 'Explicit AgentDefinition.background settings are compared using native task_started and task_notification events. Missing lifecycle evidence fails the live check; a fast final answer alone is not evidence of background execution.');
}
