import path from 'node:path';
import {readFile,realpath} from 'node:fs/promises';
import {query,type Options} from '@anthropic-ai/claude-agent-sdk';
import {classifyMessage,correlateTools,type ObservedEvent} from './messages.js';

export const root = path.resolve(import.meta.dirname,'..');

export async function runMessageExperiment(mode: unknown) {
  if (mode !== 'success' && mode !== 'denied') throw new Error('INVALID_MODE · Select the normal Read or denied Read experiment.');
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const allowedFile = await realpath(path.join(root,'fixtures/course.txt'));
  const requestedFile = mode === 'success' ? allowedFile : path.join(root,'fixtures/restricted.txt');
  const fixture = await readFile(allowedFile,'utf8');
  const marker = fixture.match(/^Session marker:\s*(.+)$/m)?.[1]?.trim();
  if (!marker) throw new Error('INVALID_FIXTURE · Add a Session marker line to fixtures/course.txt.');
  async function permitted(name: string,input: unknown) {
    if (name !== 'Read' || !input || typeof input !== 'object') return false;
    const file = (input as Record<string,unknown>).file_path;
    if (typeof file !== 'string') return false;
    try {
      const candidate = await realpath(path.resolve(root,file));
      return process.platform === 'win32' ? candidate.toLowerCase() === allowedFile.toLowerCase() : candidate === allowedFile;
    } catch {return false;}
  }
  const options: Options = {
    cwd:root,model:process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    tools:['Read'],mcpServers:{},settingSources:[],maxTurns:4,maxBudgetUsd:0.20,
    canUseTool:async (name,input) => await permitted(name,input)
      ? {behavior:'allow',updatedInput:input} : {behavior:'deny',message:'Classroom policy permits Read only for fixtures/course.txt.'},
    hooks:{PreToolUse:[{hooks:[async input => {
      if (input.hook_event_name !== 'PreToolUse' || await permitted(input.tool_name,input.tool_input)) return {};
      return {hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'Classroom policy permits Read only for fixtures/course.txt.'}};
    }]}]}
  };
  const run = query({prompt:'Use Read exactly once for '+JSON.stringify(requestedFile)+'. If it succeeds, report the Session marker from that file. If the tool is denied, briefly report the observed denial and finish.',options});
  const events: ObservedEvent[] = [];
  const frameTypes: string[] = [];
  let resultOutcome: {subtype:string;isError:boolean;answer:string} | undefined;
  let frame = 0;
  try {
    for await (const message of run) {
      frame++;
      frameTypes.push(message.type);
      events.push(...classifyMessage(message,frame));
      if (message.type === 'result') resultOutcome = {subtype:message.subtype,isError:message.is_error,
        answer:message.subtype === 'success' ? message.result : message.errors.join(' ')};
    }
    if (!resultOutcome) throw new Error('NO_RESULT · The SDK stream ended without a result.');
    const toolPairs = correlateTools(events);
    const toolResultObserved = toolPairs.length > 0 && toolPairs.every(pair => pair.requestFrame !== null && pair.requestFrame < pair.resultFrame);
    const expectedToolOutcome = mode === 'success' ? toolPairs.some(pair => !pair.isError) : toolPairs.some(pair => pair.isError);
    const verified = resultOutcome.subtype === 'success' && !resultOutcome.isError && toolResultObserved && expectedToolOutcome
      && (mode === 'denied' || resultOutcome.answer.includes(marker));
    return {mode,events,frameTypes,toolPairs,resultOutcome,verified,frames:frame,checkedAt:new Date().toISOString()};
  } finally {run.close();}
}
