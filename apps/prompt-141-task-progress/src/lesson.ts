import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { toolCalls } from './conversation.js';
export function taskActivity(events: any[]) {
  return toolCalls(events).filter(b => ['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet'].includes(b.name)).map(b => ({ toolUseId: b.id, action: b.name, input: b.input }));
}
export async function run(mode: string) {
  const discovery = await inspect({ tools: { type: 'preset', preset: 'claude_code' } });
  const required = ['TaskCreate', 'TaskUpdate', 'TaskList'], exposed: string[] = discovery.init?.tools ?? [];
  const supported = required.every(name => exposed.includes(name));
  const live = mode === 'live' ? await native(supported
    ? 'Create one task named Verify classroom queue. Mark it in_progress, then completed, using the returned task ID. List tasks and report its actual final status.'
    : 'Explain in one sentence that task-tracking tools were not exposed in this runtime.', {
      tools: supported ? required : [], allowedTools: required,
    }, true) : null;
  if (live) requireNative(live, false);
  const activity = live ? taskActivity(live.events) : [];
  return report({ supported, exposed: exposed.filter(name => /Task/.test(name)), activity,
    actualStructuredToolResults: live?.events.filter(e => e.type === 'user' && e.tool_use_result) }, {
    decisionUsesActualToolInventory: Array.isArray(exposed),
    ...(live ? supported ? { actualTaskCreated: activity.some(e => e.action === 'TaskCreate'),
      actualProgressAndCompletionUpdates: ['in_progress', 'completed'].every(status => activity.some(e => e.action === 'TaskUpdate' && e.input.status === status)) }
      : { actualFallbackResponseCompleted: live.success } : {}),
  }, { discovery, live }, 'The application renders actual task tool calls and structured results rather than inferred progress percentages or invented task IDs. Missing task-tool support is disclosed before the live path is chosen.');
}
