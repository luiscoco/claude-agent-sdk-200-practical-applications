import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { LessonError } from './numbers.js';
import type { AgentInput, AgentAnswer } from './types.js';

export async function runClaudeAgent({file, directory, signal, emit}: AgentInput): Promise<AgentAnswer> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new LessonError('MISSING_API_KEY', 'Configure ANTHROPIC_API_KEY locally before running the Claude agent. The local verifier is available without it.');
  const allowedPath = (await realpath(file)).toLowerCase();
  const isAllowedRead = async (name: string, raw: unknown) => {
    if (name !== 'Read' || !raw || typeof raw !== 'object') return false;
    const requested = (raw as Record<string, unknown>).file_path;
    if (typeof requested !== 'string') return false;
    try { return (await realpath(path.resolve(directory, requested))).toLowerCase() === allowedPath; } catch { return false; }
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) controller.abort(); else signal.addEventListener('abort', abort, {once:true});
  let readCalls = 0;
  const options: Options = {
    cwd: directory,
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    tools: ['Read'], settingSources: [], mcpServers: {},
    maxTurns: 4, maxBudgetUsd: 0.50, abortController: controller,
    // StructuredOutput is added by the SDK for outputFormat; it has no file access.
    canUseTool: async (name, input) => name === 'StructuredOutput' || await isAllowedRead(name, input)
      ? { behavior: 'allow', updatedInput: input }
      : { behavior: 'deny', message: 'This lesson permits reading only this run’s values.txt file.' },
    hooks: {
      PreToolUse: [{hooks:[async input => {
        if (input.hook_event_name !== 'PreToolUse') return {};
        if (input.tool_name === 'StructuredOutput') {
          await emit('structured_output','Schema output requested','The SDK-added StructuredOutput tool formats the final answer; it does not read files.','src/agent.ts');
          return {};
        }
        if (!await isAllowedRead(input.tool_name, input.tool_input)) {
          await emit('tool_denied','Read request denied','The requested file is outside this run’s input.','src/agent.ts');
          return {hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Only this run’s values.txt is permitted.'}};
        }
        await emit('tool_requested','Claude requested Read','This event comes from the SDK’s PreToolUse hook.','src/agent.ts',{tool:input.tool_name,input:input.tool_input,toolUseId:input.tool_use_id});
        return {};
      }]}],
      PostToolUse: [{matcher:'Read',hooks:[async input => {
        if (input.hook_event_name !== 'PostToolUse') return {};
        readCalls++;
        await emit('tool_completed','Read returned an observation','The runtime returned the file content to the model.','src/agent.ts',{tool:input.tool_name,response:input.tool_response,toolUseId:input.tool_use_id});
        return {};
      }]}]
    },
    outputFormat: {type:'json_schema',schema:{type:'object',properties:{count:{type:'integer'},total:{type:'integer'},min:{type:'integer'},max:{type:'integer'}},required:['count','total','min','max'],additionalProperties:false}}
  };
  await emit('agent_started','Claude Agent SDK started','The application starts query(); the SDK drives tool execution and subsequent model turns.','src/agent.ts');
  const run = query({
    prompt: `Use the Read tool to read ${JSON.stringify(file)}. The file contains one integer per non-empty line. Calculate count, total, min, and max from the actual file content. Do not use any other files. Return the requested structured statistics.`,
    options
  });
  let model: string | undefined;
  let answer: AgentAnswer | undefined;
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        model = message.model;
        await emit('sdk_initialized','Session initialized',`Model: ${model}. Available tools are shown in the observed initialization event.`,'src/agent.ts',{sessionId:message.session_id,model,tools:message.tools});
      }
      if (message.type === 'result') {
        if (message.subtype !== 'success' || message.is_error) throw new LessonError('AGENT_RUN_FAILED', `The SDK returned ${message.subtype}. Inspect the run evidence before retrying.`);
        if (!readCalls) throw new LessonError('READ_NOT_OBSERVED','The run did not produce an observed Read result; this lesson requires a real file read.');
        answer = {statistics:message.structured_output,model,sessionId:message.session_id,estimatedCostUsd:message.total_cost_usd,readCalls};
        await emit('agent_result','Claude returned structured statistics','A successful SDK result is now available for independent application validation.','src/agent.ts',message.structured_output);
      }
    }
    if (!answer) throw new LessonError('NO_AGENT_RESULT','The stream ended without a successful result.');
    return answer;
  } finally {
    run.close();
    signal.removeEventListener('abort',abort);
  }
}
