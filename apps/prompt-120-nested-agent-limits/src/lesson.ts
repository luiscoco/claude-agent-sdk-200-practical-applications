import { agentOptions, taskEvents, answer } from './agents.js';
import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const definitions = { coordinator: { description: 'Delegate a small arithmetic check to leaf.', prompt: 'Use leaf for the requested calculation; return its result.', tools: ['Agent'], maxTurns: 3 },
    leaf: { description: 'Calculate a small arithmetic expression.', prompt: 'Calculate the exact result and reply with the number only.', tools: [], maxTurns: 2 } };
  const options = agentOptions(definitions), discovery = await inspect(options);
  const budget = 0.35;
  const shallow = mode === 'live' ? await native('Use coordinator to ask leaf to calculate 17 + 25. Return only 42.', {
    ...options, maxBudgetUsd: budget, env: { ...process.env, CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '1', CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '1' },
  }, true) : null;
  const nested = mode === 'live' ? await native('Use coordinator, which must delegate the calculation 17 + 25 to leaf. Return only the result.', {
    ...options, maxBudgetUsd: budget, env: { ...process.env, CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: '2', CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '2' },
  }, true) : null;
  for (const result of [shallow, nested]) if (result) requireNative(result, false);
  const starts = (r: typeof shallow) => r ? taskEvents(r.events).filter(e => e.subtype === 'task_started') : [];
  return report({ limits: { shallow: { depth: 1, concurrency: 1, aggregateBudgetUsd: budget }, nested: { depth: 2, concurrency: 2, aggregateBudgetUsd: budget } },
    shallowTasks: starts(shallow), nestedTasks: starts(nested), shallowCost: shallow?.costUsd, nestedCost: nested?.costUsd }, {
    runtimeDiscoveryCompleted: discovery.result.num_turns === 0,
    ...(shallow && nested ? { shallowDepthBoundObserved: starts(shallow).length > 0 && starts(shallow).every(e => e.spawn_depth <= 1),
      actualNestedDelegationObserved: starts(nested).some(e => e.spawn_depth === 2 && e.parent_task_id),
      numericalResultCorrect: answer(nested.events).trim() === '42',
      aggregateCostWithinConfiguredCaps: shallow.costUsd <= budget && nested.costUsd <= budget } : {}),
  }, { discovery, shallow, nested }, 'Documented runtime environment limits bound depth and concurrency; maxBudgetUsd covers the query including subagents. Live checks require actual spawn_depth and parent_task_id evidence. A budget stop is surfaced as incomplete work, not a successful answer.');
}
