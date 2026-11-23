import { inspect } from './capabilities.js';
import { conversation, toolCalls } from './conversation.js';
import { writeWorkflow } from './workflow-fixture.js';
import { report } from './native.js';
export async function run(mode: string) {
  const file = await writeWorkflow(), discovery = await inspect({ tools: { type: 'preset', preset: 'claude_code' } });
  const supported = (discovery.init?.tools ?? []).includes('Workflow');
  let live = null;
  if (mode === 'live' && supported) live = await conversation({ tools: ['Workflow'], allowedTools: ['Workflow'],
    env: { ...process.env, CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '2' } }, async host => {
    const first = await host.send(`Run the Workflow script ${file}, wait for completion, and report its run ID.`, true);
    const outputs = first.events.filter(e => e.type === 'user' && e.tool_use_result?.runId).map(e => e.tool_use_result);
    const original = outputs[0]; if (!original?.runId) throw new Error('No structured native workflow runId was observed.');
    const second = await host.send(`Relaunch the same Workflow scriptPath ${original.scriptPath || file} with resumeFromRunId ${original.runId}. Do not change any agent prompts. Wait for completion and report which steps were reused.`, true);
    return { original, first, second };
  });
  return report({ supported, scriptPath: file, originalRun: live?.value.original,
    firstCost: live?.value.first.result.total_cost_usd, finalCumulativeCost: live?.value.second.result.total_cost_usd,
    reuseEvidence: live?.value.second.events.filter(e => /cached|reus|replay/.test(JSON.stringify(e))) }, {
    actualRuntimeSupportDecisionRecorded: Boolean(discovery.init),
    ...(live ? { sameNativeConversationUsed: live.value.first.result.session_id === live.value.second.result.session_id,
      actualResumeHandlePassed: toolCalls(live.value.second.events, 'Workflow').some(c => c.input.resumeFromRunId === live.value.original.runId),
      nativeReuseEvidenceObserved: live.value.second.events.some(e => /cached|reus|replay/.test(JSON.stringify(e))) } : {}),
  }, { discovery, live }, 'A real native run ID is captured from structured Workflow output and reused in the same conversation. Missing run/reuse evidence fails instead of claiming that faster execution proves cache reuse. Unsupported runtimes report the limitation without inventing a run.');
}
