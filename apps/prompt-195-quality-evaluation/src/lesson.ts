import { evaluate } from './contracts.js';
import { retrieve } from './application.js';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const good = evaluate({ text: 'Delivery jobs retry at most three times.', evidenceIds: ['D1'], tools: ['inspect'], completed: true }), bad = evaluate({ text: 'Retries are unlimited.', evidenceIds: [], tools: [], completed: false });
  const evidence = await exercise(mode, 'What is the delivery retry limit? Use retrieved evidence, cite its ID, and answer concisely.', async input => retrieve(input), 'delivery retry');
  const result = evidence.observed.events.findLast(e => e.type === 'result'), text = mode === 'live' ? result?.result || '' : 'Delivery jobs retry at most three times. [D1]';
  const score = evaluate({ text, evidenceIds: text.includes('D1') ? ['D1'] : [], tools: mode === 'live' ? evidence.calls.map(() => 'inspect') : ['inspect'], completed: mode !== 'live' || Boolean(result && !result.is_error) });
  return report({ criteria: 'One point each: grounded retry limit, D1 reference, retrieval tool use, completed substantive answer.', positiveControl: good, negativeControl: bad, evaluated: score, text, provenance: mode === 'live' ? 'actual model result' : 'declared rubric fixture' }, { rubricPositiveControl: good.score === 4, rubricRejectsFalseClaim: bad.score === 0, evaluatedTaskMeetsRubric: score.score === 4 }, evidence, 'Explicit narrow rubric with positive and negative controls. Regex scoring is suitable for this fixture only; use human review and broader datasets for open-ended quality claims.');
}
