import { inspect } from './capabilities.js';
import { conversation, toolCalls } from './conversation.js';
import { writeWorkflow, workflowScript } from './workflow-fixture.js';
import { report } from './native.js';
export async function run(mode: string) {
  const file = await writeWorkflow();
  const discovery = await inspect({ tools: { type: 'preset', preset: 'claude_code' } });
  const supported = (discovery.init?.tools ?? []).includes('Workflow');
  const live = mode === 'live' ? await conversation({ tools: supported ? ['Workflow'] : [], allowedTools: ['Workflow'],
    env: { ...process.env, CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '2', CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '1' } }, async host => {
    const turn = await host.send(supported ? `Run the Workflow script at ${file}. Wait for completion and report the consolidated result.`
      : 'State that the native Workflow tool was not exposed and no workflow was executed.', true);
    return { turn };
  }) : null;
  const calls = live ? toolCalls(live.events, 'Workflow') : [];
  return report({ scriptPath: file, script: workflowScript, supported,
    workflowEvents: live?.events.filter(e => e.task_type === 'local_workflow' || e.workflow_name) }, {
    ownedScriptDefinesParallelAndSequentialStages: workflowScript.includes('parallel(') && workflowScript.includes('phase("Combine")'),
    actualFeatureInventoryCaptured: Boolean(discovery.init),
    ...(live ? supported ? { actualWorkflowToolInvoked: calls.length > 0,
      actualWorkflowLifecycleObserved: live.events.some(e => e.task_type === 'local_workflow') }
      : { actualUnsupportedResponseCompleted: live.value.turn.result.num_turns > 0 } : {}),
  }, { discovery, live }, 'The saved script contains two parallel agents followed by a synthesis agent. Native Workflow execution is verified only in live mode and only when the tool is actually exposed. Local mode verifies discovery and the owned script, not model execution.');
}
