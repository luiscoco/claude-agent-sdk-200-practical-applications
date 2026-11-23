import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { skill, plugin } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  await skill('initial-skill', 'Return INITIAL.'); const directory = await plugin('reload-kit');
  const options = { settingSources: ['project'] as ('project')[], plugins: [{ type: 'local' as const, path: directory }], tools: ['Skill'] };
  const discovery = await inspect(options, async runtime => {
    const before = await runtime.supportedCommands();
    await skill('added-skill', 'Return ADDED_AFTER_RELOAD.');
    await writeFile(path.join(directory, 'skills/greet/SKILL.md'), '---\nname: greet\ndescription: Updated reload greeting.\n---\nReturn RELOADED_PLUGIN.');
    const skillsReload = await runtime.reloadSkills(), pluginsReload = await runtime.reloadPlugins();
    const after = await runtime.supportedCommands();
    return { before, after, skillsReload, pluginsReload };
  });
  const change = discovery.change as any;
  const live = mode === 'live' ? await native('/reload-kit:greet', { ...options, resume: discovery.result.session_id }, true) : null;
  if (live) requireNative(live, false);
  return report({ change, sameLocalSession: discovery.result.session_id, answer: live ? answer(live.events) : null }, {
    newlyCreatedSkillAbsentBeforeReload: !hasName(change.before, 'added-skill'),
    nativeReloadDiscoversNewSkill: hasName(change.skillsReload.skills, 'added-skill') && hasName(change.pluginsReload.commands, 'added-skill'),
    nativePluginReloadReported: Array.isArray(change.pluginsReload.plugins),
    ...(live ? { modelUsesUpdatedPluginContent: answer(live.events).includes('RELOADED_PLUGIN') } : {}),
  }, { discovery, live }, 'Changes are applied to a held-open native session using actual TypeScript reloadSkills and reloadPlugins controls. Live mode resumes that session and verifies changed plugin content.');
}
