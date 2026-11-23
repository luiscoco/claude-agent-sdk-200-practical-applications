import { query, type Options, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'node:crypto';

export async function native(text: string, options: Options = {}, infer = false) {
  const promptId = randomUUID();
  async function* input(): AsyncGenerator<SDKUserMessage> {
    yield { type: 'user', uuid: promptId, message: { role: 'user', content: text },
      parent_tool_use_id: null, shouldQuery: infer };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), infer ? 180000 : 45000);
  const events: any[] = [];
  let stderr = '';
  let run: ReturnType<typeof query> | undefined;
  let error: string | undefined;
  try {
  run = query({ prompt: text.startsWith('/') ? text : input(), options: {
    cwd: process.env.LAB_WORKSPACE, model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    tools: [], settingSources: [], strictMcpConfig: true, persistSession: true,
    maxTurns: 4, maxBudgetUsd: 0.75,
    env: { ...process.env }, stderr: data => { stderr = (stderr + data).slice(-12000); },
    ...options, abortController: controller,
  } });
  for await (const message of run) events.push(message);
  }
  catch (failure) { error = failure instanceof Error ? failure.message : String(failure); }
  finally { clearTimeout(timer); run?.close(); }
  const init = events.find(e => e.type === 'system' && e.subtype === 'init');
  const result = events.findLast(e => e.type === 'result');
  return { promptId, prompt: text, sessionId: init?.session_id, resultSessionId: result?.session_id,
    success: result?.subtype === 'success' && !result?.is_error && !error,
    turns: result?.num_turns, costUsd: result?.total_cost_usd, durationApiMs: result?.duration_api_ms,
    events, error, stderr };
}
export function requireNative(run: Awaited<ReturnType<typeof native>>, local = true) {
  if (!run.success || !run.sessionId || run.sessionId !== run.resultSessionId)
    throw new Error(JSON.stringify({ error: run.error, stderr: run.stderr,
      results: run.events.filter(e => e.type === 'result' || e.type === 'assistant') }));
  if (local && (run.turns !== 0 || run.costUsd !== 0 || run.durationApiMs !== 0))
    throw new Error('Expected a transcript-only operation with zero model turns and charges.');
  return run.sessionId as string;
}
export function report(output: unknown, checks: Record<string, boolean>, evidence: unknown, scope: string) {
  return { output, checks, verified: Object.values(checks).every(Boolean), evidence, scope, checkedAt: new Date().toISOString() };
}
