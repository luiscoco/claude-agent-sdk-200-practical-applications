import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const discovery = await inspect({ tools: { type: 'preset', preset: 'claude_code' } });
  const tools: string[] = discovery.init?.tools ?? [];
  const groups = { scheduling: ['CronCreate', 'CronList', 'CronDelete', 'ScheduleWakeup'], monitoring: ['Monitor'],
    repl: ['REPL', 'Python', 'NotebookEdit'], artifacts: ['Artifact'], crossSession: ['ListAgents', 'SendMessage', 'RemoteTrigger'] };
  const matrix = Object.entries(groups).map(([group, candidates]) => ({ group, available: candidates.filter(name => tools.includes(name)),
    unavailable: candidates.filter(name => !tools.includes(name)) }));
  const live = mode === 'live' ? await native('Explain one difference between process-lifetime background work and durable application jobs. Do not create schedules, publish artifacts, or contact other sessions.', {}, true) : null;
  if (live) requireNative(live, false);
  return report({ nativeVersion: discovery.init?.claude_code_version, matrix, restrictions: [
    'Tool presence does not grant authentication, cross-session authorization, or persistent hosting.',
    'Session cron/background tasks depend on the host process; durable application scheduling is separate.',
    'Artifacts and remote-session operations can require account or organization features.',
    'NotebookEdit is notebook editing, not proof of a Python REPL execution service.' ] }, {
    everyAvailableEntryActuallyAdvertised: matrix.every(row => row.available.every(name => tools.includes(name))),
    unknownReplIsNotAssumedAvailable: !tools.includes('REPL') || matrix.some(row => row.available.includes('REPL')),
    ...(live ? { actualExplanationCompleted: live.success } : {}),
  }, { discovery, live }, 'This capability inspector intentionally performs no schedule creation, artifact publication or cross-session messaging. A real model explanation is optional; it does not turn discovery into a capability execution claim.');
}
