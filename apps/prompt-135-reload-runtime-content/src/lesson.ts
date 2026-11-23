import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { skill } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const options = { settingSources: ['project'] as ('project')[] };
  const observed = await inspect(options, async runtime => {
    await skill('late-content', 'Return LATE_CONTENT_LOADED.');
    const directory = path.join(process.env.LAB_WORKSPACE!, '.claude/output-styles'); await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'classroom-style.md'), '---\nname: classroom-style\ndescription: Concise classroom explanations.\n---\nExplain concepts briefly with a concrete queue example.');
    return { skills: await runtime.reloadSkills(), outputStyles: await runtime.reloadOutputStyles() };
  });
  const changes = observed.change as any;
  const live = mode === 'live' ? await native('/late-content', { ...options, tools: ['Skill'], resume: observed.result.session_id }, true) : null;
  if (live) requireNative(live, false);
  return report(changes, { newSkillInActualReloadResponse: hasName(changes.skills.skills, 'late-content'),
    newStyleInActualReloadResponse: JSON.stringify(changes.outputStyles).includes('classroom-style'),
    ...(live ? { liveTurnUsesReloadedContent: live.events.some(e => e.type === 'result' && e.result?.includes('LATE_CONTENT_LOADED')) } : {}),
  }, { observed, live }, 'Fresh content is written only after the runtime starts. Actual reloadSkills and reloadOutputStyles responses are authoritative; a cached supportedCommands snapshot is not assumed to refresh immediately.');
}
