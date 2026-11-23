import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { skill, plugin } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  const broken = await skill('broken-skill', 'Return BROKEN.');
  await writeFile(broken.file, '---\nname: [unterminated\n---\nInvalid metadata fixture.');
  const badPlugin = await plugin('broken-plugin');
  await writeFile(path.join(badPlugin, '.claude-plugin/plugin.json'), '{ invalid-json');
  const options = { settingSources: ['project'] as ('project')[], plugins: [{ type: 'local' as const, path: badPlugin }], tools: ['Skill'] };
  let before: Awaited<ReturnType<typeof inspect>> | null = null, startupError: string | null = null;
  try { before = await inspect(options, q => q.reloadPlugins()); }
  catch (error) { startupError = error instanceof Error ? error.message : String(error); }
  await writeFile(broken.file, '---\nname: broken-skill\ndescription: Repaired owned classroom skill.\n---\nReturn REPAIRED_SKILL.');
  await writeFile(path.join(badPlugin, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'broken-plugin', version: '1.0.0' }));
  const repaired = await inspect(options);
  const live = mode === 'live' ? await native('/broken-skill', options, true) : null;
  if (live) requireNative(live, false);
  const warnings = before?.events.filter(e => /error|warn|plugin/i.test(JSON.stringify(e))) ?? [];
  return report({ before: before?.commands, startupError, diagnostics: before?.change, warnings,
    repairedCommands: repaired.commands, answer: live ? answer(live.events) : null }, {
    brokenConfigurationProducedObservableDifference: Boolean(startupError) || !hasName(before?.commands ?? [], 'broken-skill') || Boolean((before?.change as any)?.error_count),
    repairedSkillActuallyDiscovered: hasName(repaired.commands, 'broken-skill'),
    repairedPluginSkillDiscovered: hasName(repaired.commands, 'broken-plugin:greet'),
    ...(live ? { repairedSkillExecutesWithRealModel: answer(live.events).includes('REPAIRED_SKILL') } : {}),
  }, { before, repaired, live }, 'Malformed owned skill/plugin metadata is diagnosed through actual discovery, reload output or a startup failure, then repaired. Namespace collisions between healthy plugins are demonstrated separately in Prompt 128.');
}
