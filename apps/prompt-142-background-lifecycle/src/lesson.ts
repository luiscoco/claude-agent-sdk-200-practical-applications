import { inspect } from './capabilities.js';
import { conversation } from './conversation.js';
import { report } from './native.js';
export async function run(mode: string) {
  const options = { tools: ['Agent'], agents: { worker: { description: 'Perform a bounded classroom analysis in the background.',
    prompt: 'Analyze idempotent queue delivery carefully, then produce a concise report.', tools: [], background: true, maxTurns: 3 } },
    allowedTools: ['Agent'], env: { ...process.env, CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '1', CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '1' } };
  const discovery = await inspect(options);
  const live = mode === 'live' ? await conversation(options, async host => {
    const pending = host.send('Start worker as a background agent. The host will cancel this classroom task; report the observed final status.', true);
    const started = await host.waitFor(e => e.type === 'system' && e.subtype === 'task_started' && e.subagent_type === 'worker', 30000);
    await host.runtime.stopTask(started.task_id);
    const stopped = await host.waitFor(e => e.type === 'system' && e.subtype === 'task_notification' && e.task_id === started.task_id && e.status === 'stopped', 15000);
    const turn = await pending; return { started, stopped, turn };
  }) : null;
  return report({ supportedAgents: discovery.agents, lifecycle: live?.events.filter(e => e.type === 'system' && /task/.test(e.subtype)) }, {
    workerActuallyDiscovered: discovery.agents.some(a => a.name === 'worker'),
    ...(live ? { exactTaskStopped: live.value.started.task_id === live.value.stopped.task_id,
      stoppedStatusActuallyObserved: live.value.stopped.status === 'stopped' } : {}),
  }, { discovery, live }, 'Cancellation uses the native task ID from task_started and requires a matching stopped notification. An already-completed task is not relabelled cancelled. The input stream remains open while the host controls background work.');
}
