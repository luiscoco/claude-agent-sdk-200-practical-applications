import path from 'node:path';
import {realpath} from 'node:fs/promises';
import {query, type Options} from '@anthropic-ai/claude-agent-sdk';
import {expectedMarkers, projectDirectory, selectedTarget} from './project.js';

export async function runConventions(name: string, loadProjectSettings: boolean) {
  if (typeof loadProjectSettings !== 'boolean') throw new Error('INVALID_SETTINGS_SELECTION · Choose whether project settings load.');
  const target = await selectedTarget(name);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const events: {type:string; data:unknown}[] = [];
  const instructionLoads: {file:string; reason:string; memoryType:string; trigger?:string; globs?:string[]}[] = [];
  let readCalls = 0;

  async function permittedRead(name: string, input: unknown) {
    if (name !== 'Read' || !input || typeof input !== 'object') return false;
    const requested = (input as Record<string, unknown>).file_path;
    if (typeof requested !== 'string') return false;
    try {
      const actual = await realpath(path.resolve(projectDirectory, requested));
      return process.platform === 'win32' ? actual.toLowerCase() === target.absolute.toLowerCase() : actual === target.absolute;
    } catch { return false; }
  }

  const options: Options = {
    cwd: projectDirectory,
    systemPrompt: {type:'preset', preset:'claude_code'},
    settingSources: loadProjectSettings ? ['project'] : [],
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    tools: ['Read'], mcpServers: {}, maxTurns:5, maxBudgetUsd:0.50,
    canUseTool: async (name, input) => name === 'StructuredOutput' || await permittedRead(name, input)
      ? {behavior:'allow', updatedInput:input}
      : {behavior:'deny', message:'This classroom application permits reading only the selected target file.'},
    hooks: {
      InstructionsLoaded: [{hooks:[async input => {
        if (input.hook_event_name !== 'InstructionsLoaded') return {};
        instructionLoads.push({file:input.file_path, reason:input.load_reason, memoryType:input.memory_type, trigger:input.trigger_file_path, globs:input.globs});
        return {};
      }]}],
      PreToolUse: [{hooks:[async input => {
        if (input.hook_event_name !== 'PreToolUse' || input.tool_name === 'StructuredOutput') return {};
        if (await permittedRead(input.tool_name, input.tool_input)) return {};
        return {hookSpecificOutput:{hookEventName:'PreToolUse', permissionDecision:'deny', permissionDecisionReason:'Only the selected target file is permitted by this application.'}};
      }]}],
      PostToolUse: [{matcher:'Read', hooks:[async input => {
        if (input.hook_event_name !== 'PostToolUse') return {};
        readCalls++;
        events.push({type:'read_completed', data:input.tool_response});
        return {};
      }]}]
    },
    outputFormat: {type:'json_schema', schema:{
      type:'object',
      properties:{title:{type:'string'}, identifier:{type:'string'}, projectMarker:{type:'string'}, ruleMarker:{type:'string'}},
      required:['title','identifier','projectMarker','ruleMarker'], additionalProperties:false
    }}
  };
  const run = query({
    prompt: `Use Read to inspect ${JSON.stringify(target.file)}. Extract its requested title and suggest an identifier following the loaded project conventions. Report projectMarker and ruleMarker from loaded instructions, or UNKNOWN for each marker that is absent. Read only the requested target file.`,
    options
  });
  try {
    for await (const message of run) {
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error) {
        const detail = message.subtype === 'success' ? message.result : message.errors.join(' ');
        throw new Error('SDK_RESULT_ERROR · '+detail.slice(0, 2000));
      }
      if (!readCalls) throw new Error('READ_NOT_OBSERVED · A completed target file Read is required.');
      const answer = message.structured_output as {title:string; identifier:string; projectMarker:string; ruleMarker:string};
      if (!answer) throw new Error('INVALID_AGENT_RESULT · The SDK returned no structured convention result.');
      const expected = {title:target.title, ...await expectedMarkers(loadProjectSettings, target.ruleApplies)};
      const context = await run.getContextUsage();
      const memoryFiles = context.memoryFiles;
      const projectFileObserved = instructionLoads.some(item => path.relative(projectDirectory, item.file).replaceAll('\\', '/') === 'CLAUDE.md');
      const ruleFileObserved = instructionLoads.some(item => path.relative(projectDirectory, item.file).replaceAll('\\', '/') === '.claude/rules/typescript.md');
      const instructionFilesVerified = projectFileObserved === loadProjectSettings
        && ruleFileObserved === (loadProjectSettings && target.ruleApplies);
      const verified = answer?.title === expected.title
        && answer.projectMarker === expected.projectMarker
        && answer.ruleMarker === expected.ruleMarker
        && (!loadProjectSettings || answer.identifier === target.identifier)
        && instructionFilesVerified;
      return {target:name, file:target.file, cwd:projectDirectory, loadProjectSettings, answer, expected, verified, readCalls, instructionFilesVerified, instructionLoads, memoryFiles, events, sessionId:message.session_id, estimatedCostUsd:message.total_cost_usd};
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  } finally { run.close(); }
}
