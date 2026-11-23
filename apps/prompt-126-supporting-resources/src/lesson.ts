import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { skill } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  const reference = 'Queue delivery: maximum attempts 3; idempotency required; dead-letter queue enabled.';
  const created = await skill('queue-reference', 'Read reference.txt in this skill directory. Return the maximum attempts and whether idempotency is required. Cite the reference.');
  const referenceFile = path.join(created.directory, 'reference.txt'); await writeFile(referenceFile, reference);
  const options = { settingSources: ['project'] as ('project')[], tools: ['Skill', 'Read'], allowedTools: ['Skill'],
    canUseTool: async (name: string, input: Record<string, unknown>) => name === 'Read' && typeof input.file_path === 'string' && [referenceFile, created.file].includes(path.resolve(input.file_path))
      ? { behavior: 'allow' as const, updatedInput: input } : { behavior: 'deny' as const, message: 'Read only this skill’s owned resources.' } };
  const discovery = await inspect(options);
  const live = mode === 'live' ? await native('/queue-reference', options, true) : null;
  if (live) requireNative(live, false);
  return report({ skill: created.file, reference: referenceFile, sha256: createHash('sha256').update(await readFile(referenceFile)).digest('hex'),
    dependencies: ['SDK Skill tool', 'Read tool', 'bundled reference.txt; no shell/script dependency'], answer: live ? answer(live.events) : null }, {
    nativeSkillDiscovered: hasName(discovery.commands, 'queue-reference'),
    ...(live ? { actualReferenceReadObserved: live.events.some(e => e.type === 'assistant' && e.message?.content?.some((b: any) => b.type === 'tool_use' && b.name === 'Read' && path.resolve(b.input.file_path) === referenceFile)),
      modelUsesReferenceFacts: /3/.test(answer(live.events)) && /idempotenc/i.test(answer(live.events)) } : {}),
  }, { discovery, live }, 'A bundled reference is used instead of arbitrary command execution. Live verification requires an actual Read call to the reference and an answer reflecting its facts.');
}
