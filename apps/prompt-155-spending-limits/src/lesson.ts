import { native, requireNative, report } from './native.js';
import { latestResult, usageView } from './accounting.js';
export async function run(mode: string) {
  const cap = 0.02;
  const options = { maxBudgetUsd: cap, maxTurns: 10, tools: ['Agent'], allowedTools: ['Agent'],
    agents: { analyst: { description: 'Analyze a classroom queue design.', prompt: 'Analyze retry bounds and idempotency; produce a concise report.', tools: [], maxTurns: 3 } },
    env: { ...process.env, CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '1', CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '1' } };
  const observed = await native(mode === 'live' ? 'Delegate a queue safety analysis to analyst, then synthesize its findings.' : 'Owned spending-cap configuration baseline.', options, mode === 'live');
  if (mode !== 'live') requireNative(observed); const result = latestResult(observed.events);
  return report({ configuredEstimatedCapUsd: cap, ...usageView(result), iteratorException: observed.error,
    complete: result?.subtype === 'success' && !result.is_error && !observed.error }, {
    nativeCapConfigurationAcceptedLocally: mode === 'live' || observed.success,
    ...(mode === 'live' ? { budgetStopObserved: result?.subtype === 'error_max_budget_usd' || result?.terminal_reason === 'budget_exhausted',
      budgetStopNotMistakenForCompletedWork: result?.subtype !== 'success' || Boolean(result?.is_error) } : {}),
  }, observed, 'maxBudgetUsd bounds estimated aggregate query spending, including delegated work. A request already in flight can affect the final estimate. This demonstration requires an actual native budget-stop event; it does not simulate one or promise a billing hard limit.');
}
