import path from 'node:path';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { inspectProject, isProjectRead } from './projects.js';

export async function runProject(name: string, loadProjectSettings = true) {
  const project = await inspectProject(name);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const events: {type:string; detail:string; data?:unknown}[] = [];
  let readCalls = 0;
  let initializedCwd = '';
  const options: Options = {
    cwd: project.directory,
    settingSources: loadProjectSettings ? ['project'] : [],
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    systemPrompt: 'You are a project inspection agent. Follow project instructions supplied as system reminders. Read the requested file with the Read tool and report its actual content.',
    tools: ['Read'], mcpServers: {}, maxTurns: 5, maxBudgetUsd: 0.50,
    canUseTool: async (name, input) => name === 'StructuredOutput' || await isProjectRead(project.directory, name, input)
      ? {behavior:'allow', updatedInput:input}
      : {behavior:'deny', message:'This classroom application permits Read only for the selected project README.md.'},
    hooks: {
      PreToolUse: [{hooks:[async input => {
        if (input.hook_event_name !== 'PreToolUse' || input.tool_name === 'StructuredOutput') return {};
        const allowed = await isProjectRead(project.directory, input.tool_name, input.tool_input);
        events.push({type:allowed?'read_requested':'read_denied', detail:allowed?'Read requested inside the selected project.':'The classroom file policy denied this request.', data:{cwd:input.cwd, input:input.tool_input}});
        return allowed ? {} : {hookSpecificOutput:{hookEventName:'PreToolUse', permissionDecision:'deny', permissionDecisionReason:'Only the selected README.md is permitted by this application.'}};
      }]}],
      PostToolUse: [{matcher:'Read', hooks:[async input => {
        if (input.hook_event_name !== 'PostToolUse') return {};
        readCalls++;
        events.push({type:'read_completed', detail:'Observed Read tool response.', data:input.tool_response});
        return {};
      }]}]
    },
    outputFormat: {type:'json_schema', schema:{type:'object', properties:{project:{type:'string'}, product:{type:'string'}, instructionMarker:{type:'string'}}, required:['project','product','instructionMarker'], additionalProperties:false}}
  };
  const run = query({
    prompt: 'Read README.md in the current working directory using Read. Report the Project and Product values. Report the instruction marker supplied by project instructions, or UNKNOWN if no marker is supplied. Do not read any other file.',
    options
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        initializedCwd = message.cwd;
        events.push({type:'initialized', detail:'SDK session initialized.', data:{cwd:message.cwd, model:message.model, sessionId:message.session_id}});
      }
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error) throw new Error('SDK_RESULT_ERROR · '+message.subtype);
      if (!readCalls) throw new Error('READ_NOT_OBSERVED · A completed Read is required for this lesson.');
      const answer = message.structured_output as {project:string; product:string; instructionMarker:string};
      const expected = {
        project: project.readme.match(/^Project: (.+)$/m)![1],
        product: project.readme.match(/^Product: (.+)$/m)![1],
        instructionMarker: loadProjectSettings ? project.instructions.match(/marker is (\S+)/)![1] : 'UNKNOWN'
      };
      const verified = Object.entries(expected).every(([key,value]) => answer?.[key as keyof typeof answer] === value);
      events.push({type:'result', detail:verified?'Answer matches the selected project fixtures.':'Answer differs from the selected fixture evidence.'});
      return {project:name, cwd:project.directory, initializedCwd, settingSources:options.settingSources, answer, expected, verified, readCalls, sessionId:message.session_id, estimatedCostUsd:message.total_cost_usd, events};
    }
    throw new Error('NO_RESULT · The stream ended without a result.');
  } finally { run.close(); }
}
