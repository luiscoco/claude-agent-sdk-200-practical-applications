import path from 'node:path';
import {readFile, realpath, writeFile} from 'node:fs/promises';
import {query, type Options} from '@anthropic-ai/claude-agent-sdk';
import {createWorkspace, runTests, testCommand, testCounts, validateStyle} from './workspace.js';

export async function runStyleExperiment(selectedStyle: string) {
  const style = validateStyle(selectedStyle);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const location = await createWorkspace();
  const calculator = await realpath(path.join(location.workspace, 'src/calculator.mjs'));
  const tests = await realpath(path.join(location.workspace, 'tests/calculator.test.mjs'));
  const before = await readFile(calculator, 'utf8');
  const baseline = await runTests(location.workspace);
  if (baseline.exitCode !== 1 || !baseline.counts.failed) throw new Error('UNEXPECTED_BASELINE · The fresh classroom fixture must produce failing test assertions.');
  const events: {tool:string; input:unknown; response:unknown}[] = [];
  const deniedTools: {tool:string; input:unknown}[] = [];
  let activeStyle = '';

  async function permitted(name: string, input: unknown) {
    if (!input || typeof input !== 'object') return false;
    const values = input as Record<string, unknown>;
    if (name === 'Bash') return values.command === testCommand;
    if (!['Read', 'Edit'].includes(name) || typeof values.file_path !== 'string') return false;
    try {
      const file = await realpath(path.resolve(location.workspace, values.file_path));
      const normalized = process.platform === 'win32' ? file.toLowerCase() : file;
      const allowed = name === 'Read' ? [calculator, tests] : [calculator];
      return allowed.some(candidate => (process.platform === 'win32' ? candidate.toLowerCase() : candidate) === normalized);
    } catch { return false; }
  }

  const options: Options = {
    cwd:location.workspace,
    systemPrompt:{type:'preset', preset:'claude_code'},
    settingSources:['project'],
    settings:{outputStyle:style},
    env:{...process.env, CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT:'0'},
    model:process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    tools:['Read','Edit','Bash'], mcpServers:{}, maxTurns:8, maxBudgetUsd:1,
    canUseTool:async (name, input) => await permitted(name, input)
      ? {behavior:'allow', updatedInput:input}
      : {behavior:'deny', message:'Read the calculator and its tests, edit only the calculator, and run exactly '+testCommand},
    hooks:{
      PreToolUse:[{hooks:[async input => {
        if (input.hook_event_name !== 'PreToolUse' || await permitted(input.tool_name, input.tool_input)) return {};
        deniedTools.push({tool:input.tool_name, input:input.tool_input});
        return {hookSpecificOutput:{hookEventName:'PreToolUse', permissionDecision:'deny', permissionDecisionReason:'Use only the classroom calculator files and exact test command.'}};
      }]}],
      PostToolUse:[{matcher:'Read|Edit|Bash', hooks:[async input => {
        if (input.hook_event_name !== 'PostToolUse') return {};
        events.push({tool:input.tool_name, input:input.tool_input, response:input.tool_response});
        return {};
      }]}]
    }
  };
  const run = query({
    prompt:'Fix add() in src/calculator.mjs so it adds numbers correctly. Read its test file and apply a focused Edit. The runtime already selected the correct working directory. Set the Bash command field to exactly '+JSON.stringify(testCommand)+'. Complete the task and report the observed verification.',
    options
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') activeStyle = message.output_style;
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error) {
        const detail = message.subtype === 'success' ? message.result : message.errors.join(' ');
        throw new Error('SDK_RESULT_ERROR · '+detail.slice(0, 2000));
      }
      const after = await readFile(calculator, 'utf8');
      const verification = await runTests(location.workspace);
      const sectionsMatched = ['Changes','Why','Verification'].every(section => new RegExp('^#{1,3}\\s+'+section+'\\s*$', 'mi').test(message.result));
      const bashOutput = events.filter(event => event.tool === 'Bash').at(-1)?.response as {stdout?:string; interrupted?:boolean} | undefined;
      const observedTestCounts = testCounts(bashOutput?.stdout || '');
      const toolVerificationPassed = !bashOutput?.interrupted && observedTestCounts.total > 0
        && observedTestCounts.passed === observedTestCounts.total && observedTestCounts.failed === 0;
      const verified = verification.exitCode === 0 && verification.counts.total === baseline.counts.total
        && verification.counts.passed === verification.counts.total && verification.counts.failed === 0
        && observedTestCounts.total === baseline.counts.total && before !== after
        && events.some(event => event.tool === 'Edit') && toolVerificationPassed
        && activeStyle === style && (style === 'default' || sectionsMatched);
      const report = {id:location.id, style, activeStyle, before, after, baseline, verification, sectionsMatched, toolVerificationPassed, verified, answer:message.result, events, deniedTools, sessionId:message.session_id, estimatedCostUsd:message.total_cost_usd};
      await writeFile(path.join(location.directory, 'report.json'), JSON.stringify(report, null, 2));
      return report;
    }
    throw new Error('NO_RESULT · The SDK stream ended without a result.');
  } finally { run.close(); }
}
