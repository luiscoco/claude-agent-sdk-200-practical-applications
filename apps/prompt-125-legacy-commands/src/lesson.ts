import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { skill } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  const directory = path.join(process.env.LAB_WORKSPACE!, '.claude/commands'); await mkdir(directory, { recursive: true });
  const legacyFile = path.join(directory, 'queue-summary.md');
  const body = 'Return only MIGRATED_QUEUE=$ARGUMENTS.';
  await writeFile(legacyFile, '---\ndescription: Summarize a classroom queue name.\n---\n' + body);
  const options = { settingSources: ['project'] as ('project')[], tools: ['Skill'] };
  const before = await inspect(options);
  const legacy = mode === 'live' ? await native('/queue-summary delivery', options, true) : null;
  if (legacy) requireNative(legacy, false);
  await unlink(legacyFile); // Only the exact owned fixture created above is removed.
  const migrated = await skill('queue-summary', body);
  const after = await inspect(options);
  const modern = mode === 'live' ? await native('/queue-summary delivery', options, true) : null;
  if (modern) requireNative(modern, false);
  return report({ legacyFile, skillFile: migrated.file, before: before.commands, after: after.commands,
    legacyAnswer: legacy ? answer(legacy.events) : null, skillAnswer: modern ? answer(modern.events) : null }, {
    legacyCommandDiscovered: hasName(before.commands, 'queue-summary'), migratedSkillDiscovered: hasName(after.commands, 'queue-summary'),
    ...(legacy && modern ? { realModelBehaviorPreserved: answer(legacy.events).trim() === 'MIGRATED_QUEUE=delivery' && answer(modern.events).trim() === 'MIGRATED_QUEUE=delivery' } : {}),
  }, { before, after, legacy, modern }, 'A fresh owned legacy command is replaced with a SKILL.md using the same command name, body and argument contract. Live mode compares actual outputs before and after migration.');
}
