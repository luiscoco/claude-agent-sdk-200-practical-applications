import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { skill } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  const created = await skill('queue-brief', 'Read reference.txt beside this skill. Format the supplied queue idea using its three headings. Include CLASSROOM_BRIEF.\nInput: $ARGUMENTS', 'argument-hint: "queue idea"\n');
  await writeFile(path.join(created.directory, 'reference.txt'), 'Headings: Purpose, Retry policy, Idempotency.');
  const options = { settingSources: ['project'] as ('project')[], tools: ['Skill', 'Read'], allowedTools: ['Skill', 'Read'] };
  const discovery = await inspect(options);
  const live = mode === 'live' ? await native('/queue-brief Email delivery with three retries and an idempotency key.', options, true) : null;
  if (live) requireNative(live, false);
  return report({ skillFile: created.file, supportingReference: await readFile(path.join(created.directory, 'reference.txt'), 'utf8'),
    commands: discovery.commands, answer: live ? answer(live.events) : null }, {
    nativeSkillDiscoveryVerified: hasName(discovery.commands, 'queue-brief'),
    ...(live ? { realModelAppliesSkill: answer(live.events).includes('CLASSROOM_BRIEF'),
      supportingHeadingsUsed: ['Purpose', 'Retry policy', 'Idempotency'].every(h => answer(live.events).includes(h)) } : {}),
  }, { discovery, live }, 'A real project SKILL.md contains metadata, argument substitution and a bundled reference. Local discovery is verified; live mode dispatches the skill through the actual runtime.');
}
