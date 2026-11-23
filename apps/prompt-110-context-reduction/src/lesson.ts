import { native, requireNative, report } from './native.js';
import { measure } from './context.js';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function run(mode: string) {
  const marker = 'ANSWER_' + randomUUID();
  const records = Array.from({ length: 600 }, (_, i) => ({ id: i, owner: `team-${i % 13}`, policy: 'Exponential backoff with idempotency keys.', answer: i === 347 ? marker : 'unrelated' }));
  const focused = records.filter(r => r.id === 347);
  const full = await native('Classroom retrieved records:\n' + JSON.stringify(records));
  const focusedRun = await native('Classroom focused retrieved records:\n' + JSON.stringify(focused));
  const fullId = requireNative(full), focusedId = requireNative(focusedRun);
  const fullContext = await measure(fullId), focusedContext = await measure(focusedId);
  const prompt = 'Return only the exact answer field from retrieved record 347.';
  const broadTools = ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'];
  const fullAnswer = mode === 'live' ? await native(prompt, { resume: fullId,
    tools: broadTools, canUseTool: async () => ({ behavior: 'deny', message: 'Answer from the already retrieved classroom records.' }),
  }, true) : null;
  const focusedAnswer = mode === 'live' ? await native(prompt, { resume: focusedId }, true) : null;
  if (fullAnswer) requireNative(fullAnswer, false); if (focusedAnswer) requireNative(focusedAnswer, false);
  const datasetFile = path.join(process.env.LAB_WORKSPACE!, 'queue-records.json');
  await writeFile(datasetFile, JSON.stringify(records));
  const delegated = mode === 'live' ? await native(
    'Use the queue-reader specialist to get the answer field of record 347 from queue-records.json. Return only that exact field.', {
      tools: ['Agent', 'Read'], agents: { 'queue-reader': {
        description: 'Retrieve exact queue-record facts from the owned local queue-records.json dataset.',
        prompt: 'Read queue-records.json. Return only the answer field from the requested record. Do not repeat the entire dataset.',
        tools: ['Read'], maxTurns: 3, model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      } },
      canUseTool: async (name, input) => {
        if (name === 'Agent') return { behavior: 'allow', updatedInput: input };
        return name === 'Read' && typeof input.file_path === 'string' && path.resolve(input.file_path) === datasetFile
          ? { behavior: 'allow', updatedInput: input }
          : { behavior: 'deny', message: 'Read only the owned queue dataset.' };
      },
    }, true) : null;
  if (delegated) requireNative(delegated, false);
  const answer = (r: typeof fullAnswer) => r?.events.findLast(e => e.type === 'result')?.result?.trim();
  const usage = (r: typeof fullAnswer) => {
    const result = r?.events.findLast(e => e.type === 'result');
    return result ? { usage: result.usage, modelUsage: result.modelUsage, totalCostUsd: result.total_cost_usd,
      subagentStats: result.subagent_stats } : null;
  };
  const fullTokens = fullContext.usage.total_tokens, focusedTokens = focusedContext.usage.total_tokens;
  return report({ strategy: 'Focused retrieval', fullRecords: records.length, focusedRecords: focused.length,
    fullNativeEstimatedTokens: fullTokens, focusedNativeEstimatedTokens: focusedTokens,
    reductionPercent: fullTokens ? (1 - focusedTokens / fullTokens) * 100 : null,
    fullAnswer: answer(fullAnswer), focusedAnswer: answer(focusedAnswer), delegatedAnswer: answer(delegated),
    catalogs: { broad: broadTools, focused: [], delegated: ['Agent', 'Read'], specialist: ['Read'] },
    actualInferenceUsage: { broad: usage(fullAnswer), focused: usage(focusedAnswer), delegated: usage(delegated) },
    comparisonNote: 'Broad versus focused changes both retrieval size and catalog size. It is a combined intervention, not an isolated attribution. Delegation may cost more overall; inspect actual totals including specialist work.' }, {
    relevantRecordPreserved: focused[0].answer === marker,
    nativeContextEstimateReduced: focusedTokens < fullTokens,
    ...(mode === 'live' ? { fullModelFindsExactFact: answer(fullAnswer) === marker,
      focusedModelPreservesAnswerQuality: answer(focusedAnswer) === marker,
      delegatedModelPreservesAnswerQuality: answer(delegated) === marker,
      actualSpecialistInvoked: delegated!.events.some(e => e.type === 'system' && e.subtype === 'task_started') ||
        Boolean(delegated!.events.findLast(e => e.type === 'result')?.subagent_stats?.spawned > 0),
    } : {}),
  }, { fullContext, focusedContext, fullAnswer, focusedAnswer, delegated }, 'Native transcript estimates compare broad and focused retrieval. Live mode also compares full and smaller tool catalogs and actual specialist delegation, checking exact answer quality and exposing native usage/cost records. No reduction in total delegated cost is assumed.');
}
