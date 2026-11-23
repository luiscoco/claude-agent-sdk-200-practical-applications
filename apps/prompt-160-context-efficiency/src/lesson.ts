import { native, requireNative, report } from './native.js';
import { latestResult, usageView } from './accounting.js';
export async function run(mode: string) {
  const reference = Array.from({ length: 120 }, (_, i) => `Reference ${i}: queue safety requires idempotency and at most three retries.`).join('\n');
  const scenarios = [{ name: 'Broad catalog', prompt: reference, tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write', 'Edit'] },
    { name: 'Stable focused prefix', prompt: reference, tools: [] }];
  const samples = [];
  for (const item of scenarios) {
    const start = performance.now(), observed = await native(mode === 'live' ? 'State the maximum retries as digits only.' : 'Owned efficiency configuration baseline.', {
      systemPrompt: item.prompt, tools: item.tools, canUseTool: async () => ({ behavior: 'deny', message: 'Answer from the supplied reference only.' }),
    }, mode === 'live');
    requireNative(observed, mode !== 'live'); const result = latestResult(observed.events);
    samples.push({ name: item.name, catalogSize: item.tools.length, elapsedMs: performance.now() - start, answer: result?.result, usage: usageView(result), evidence: observed });
  }
  return report({ samples, interpretation: 'Inspect measured values; reduced cost or latency is an observation, not a preset success condition. The static prefix remains identical across these two cases.' }, {
    bothActualConfigurationsExecuted: samples.length === 2,
    ...(mode === 'live' ? { answerQualityPreserved: samples.every(s => s.answer?.trim() === '3') } : {}),
  }, {}, 'A stable prompt prefix and smaller offered tool catalog are compared using actual usage/cost/latency. The app does not assume optimization always wins, and treats one sample per configuration as illustrative.');
}
