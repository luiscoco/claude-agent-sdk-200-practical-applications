import { skill } from './extensions.js';
import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  await skill('alpha-brief', 'Return ALPHA_SELECTED.'); await skill('beta-brief', 'Return BETA_SELECTED.');
  const common = { settingSources: ['project'] as ('project')[], tools: ['Skill'] };
  const named = await inspect({ ...common, skills: ['alpha-brief'] });
  const all = await inspect({ ...common, skills: 'all' });
  const disabled = await inspect({ ...common, skills: [] });
  const advertised = (r: typeof all) => r.init?.skills ?? [];
  const live = mode === 'live' ? await native('Use alpha-brief to format this response.', { ...common, skills: ['alpha-brief'] }, true) : null;
  const off = mode === 'live' ? await native('Use alpha-brief through the Skill tool only if available. Otherwise return UNKNOWN. Do not read files or infer its contents.', { ...common, skills: [] }, true) : null;
  for (const result of [live, off]) if (result) requireNative(result, false);
  return report({ namedAdvertised: advertised(named), allAdvertised: advertised(all), disabledAdvertised: advertised(disabled),
    commandMenus: { named: named.commands, all: all.commands, disabled: disabled.commands }, answer: live ? answer(live.events) : null,
    disabledAnswer: off ? answer(off.events) : null,
    interpretation: 'init.skills is a user-invocable inventory. It is not proof of the model-invocation allowlist. Local discovery cannot certify model selection restrictions.' }, {
    namedSelectionAdvertisesAlpha: advertised(named).includes('alpha-brief'),
    allSelectionAdvertisesBoth: ['alpha-brief', 'beta-brief'].every(n => advertised(all).includes(n)),
    disabledSelectionDoesNotHideDirectCommandInventory: ['alpha-brief', 'beta-brief'].every(n => advertised(disabled).includes(n)),
    ...(live && off ? { modelActuallyInvokesSelectedSkill: answer(live.events).includes('ALPHA_SELECTED'),
      disabledModelCannotUseSkillContents: answer(off.events).trim() === 'UNKNOWN' } : {}),
  }, { named, all, disabled, live, off }, 'The native init.skills array inventories user-invocable skills and is intentionally not a model-selection test. Actual enabled/disabled model behavior is checked only in live mode; direct dispatch and filesystem access are distinct.');
}
