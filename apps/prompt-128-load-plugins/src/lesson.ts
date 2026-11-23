import { plugin } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  const alpha = await plugin('alpha-kit'), beta = await plugin('beta-kit');
  const options = { plugins: [{ type: 'local' as const, path: alpha }, { type: 'local' as const, path: beta }], tools: ['Skill'] };
  const discovery = await inspect(options);
  const first = mode === 'live' ? await native('/alpha-kit:greet ONE', options, true) : null;
  const second = mode === 'live' ? await native('/beta-kit:greet TWO', options, true) : null;
  for (const result of [first, second]) if (result) requireNative(result, false);
  return report({ pluginPaths: [alpha, beta], commands: discovery.commands,
    alphaAnswer: first ? answer(first.events) : null, betaAnswer: second ? answer(second.events) : null }, {
    duplicateLocalSkillNamesAreNamespaced: ['alpha-kit:greet', 'beta-kit:greet'].every(n => hasName(discovery.commands, n)),
    ...(first && second ? { alphaCommandUsesAlphaPlugin: answer(first.events).includes('ALPHA-KIT_GREETING') && answer(first.events).includes('ONE'),
      betaCommandUsesBetaPlugin: answer(second.events).includes('BETA-KIT_GREETING') && answer(second.events).includes('TWO') } : {}),
  }, { discovery, first, second }, 'Two distinct plugins each contain greet. Native command discovery and live invocation verify namespace separation instead of assuming filesystem names are globally unique.');
}
