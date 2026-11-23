import { query, startup, prewarm, type Options, type SDKUserMessage, type Query } from '@anthropic-ai/claude-agent-sdk';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const measurements: any[] = [];
  for (const method of ['query', 'startup', 'prewarm']) {
    const cwd = path.join(process.env.LAB_WORKSPACE!, method); await mkdir(cwd, { recursive: true });
    let stderr = '';
    const options: Options = { cwd, tools: [], settingSources: [], strictMcpConfig: true, model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6', env: { ...process.env }, stderr: data => { stderr = (stderr + data).slice(-4000); } };
    async function* prompt(): AsyncGenerator<SDKUserMessage> { yield { type: 'user', uuid: randomUUID(), message: { role: 'user', content: 'Owned startup timing fixture.' }, parent_tool_use_id: null, shouldQuery: false }; }
    const start = performance.now(); let runtime: Query, preparationMs = 0;
    if (method === 'query') runtime = query({ prompt: prompt(), options });
    else if (method === 'startup') { const warm = await startup({ options, initializeTimeoutMs: 45000 }); preparationMs = performance.now() - start; runtime = warm.query(prompt()); }
    else { const spare = await prewarm({ options: { ...options, cwd: undefined }, initializeTimeoutMs: 45000 }); preparationMs = performance.now() - start; runtime = spare.claim({ prompt: prompt(), options: { cwd, model: options.model } }); void spare.claimed.catch(() => {}); }
    const events: any[] = []; let initAt = 0;
    try { for await (const event of runtime) { events.push(event); if (event.type === 'system' && event.subtype === 'init') initAt = performance.now(); } }
    catch (error) { throw new Error(method + ' native startup failed: ' + (error instanceof Error ? error.message : String(error)) + ' ' + stderr + ' ' + JSON.stringify(events.filter(e => e.type === 'result'))); }
    finally { runtime.close(); }
    const result = events.findLast(e => e.type === 'result');
    measurements.push({ method, preparationMs, totalUntilInitMs: initAt ? initAt - start : null,
      postPreparationUntilInitMs: initAt ? initAt - start - preparationMs : null, totalMs: performance.now() - start,
      success: result?.subtype === 'success' && !result.is_error, turns: result?.num_turns, costUsd: result?.total_cost_usd });
  }
  const live = mode === 'live' ? await native('Explain why prewarming moves startup work earlier rather than eliminating it. Use one sentence.', {}, true) : null;
  if (live) requireNative(live, false);
  return report({ measurements, sampling: 'One observed sample per strategy, including preparation; no statistical performance claim.' }, {
    allThreeActualStrategiesExecuted: measurements.length === 3 && measurements.every(m => m.success),
    noInferenceDuringTiming: measurements.every(m => m.turns === 0 && m.costUsd === 0),
    initializationLatencyCaptured: measurements.every(m => m.totalUntilInitMs !== null),
    ...(live ? { actualModelExplanationCompleted: live.success } : {}),
  }, { live }, 'Actual query, startup and alpha prewarm paths are measured separately. Preparation time is included and displayed; the app never labels a zero-cost parking phase as eliminated total startup cost.');
}
