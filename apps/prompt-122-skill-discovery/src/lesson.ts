import { skill } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  const project = await skill('project-brief', 'Return PROJECT_SCOPE.'), personal = await skill('personal-brief', 'Return PERSONAL_SCOPE.', '', 'user');
  const both = await inspect({ settingSources: ['user', 'project'] });
  const projectOnly = await inspect({ settingSources: ['project'] });
  const excluded = await inspect({ settingSources: [] });
  const live = mode === 'live' ? await native('/project-brief', { settingSources: ['project'], tools: ['Skill'] }, true) : null;
  if (live) requireNative(live, false);
  return report({ project: project.file, personal: personal.file, both: both.commands, projectOnly: projectOnly.commands, excluded: excluded.commands,
    answer: live ? answer(live.events) : null }, {
    bothOwnedScopesDiscovered: hasName(both.commands, 'project-brief') && hasName(both.commands, 'personal-brief'),
    projectOnlyExcludesPersonal: hasName(projectOnly.commands, 'project-brief') && !hasName(projectOnly.commands, 'personal-brief'),
    noSourcesExcludesOwnedSkills: !hasName(excluded.commands, 'project-brief') && !hasName(excluded.commands, 'personal-brief'),
    ...(live ? { actualProjectSkillExecutes: answer(live.events).includes('PROJECT_SCOPE') } : {}),
  }, { both, projectOnly, excluded, live }, 'The personal fixture is created inside the experiment’s private CLAUDE_CONFIG_DIR, not in your actual personal skill library. Native discovery is compared across settingSources scopes.');
}
