import { randomUUID } from 'node:crypto';
import { skill } from './extensions.js';
import { inspect, hasName } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import { answer } from './agents.js';
export async function run(mode: string) {
  const token = 'ARGUMENT_' + randomUUID();
  await skill('argument-echo', 'Return only EXACT_ARGUMENT=$ARGUMENTS with no explanation.',
    'argument-hint: "value to echo"\ndisable-model-invocation: true\nuser-invocable: true\n');
  await skill('hidden-echo', 'Return HIDDEN.', 'user-invocable: false\n');
  const options = { settingSources: ['project'] as ('project')[], tools: ['Skill'] };
  const discovery = await inspect(options);
  const live = mode === 'live' ? await native('/argument-echo ' + token, options, true) : null;
  if (live) requireNative(live, false);
  return report({ command: '/argument-echo', argument: token, advertisedSkills: discovery.init?.skills,
    directCommands: discovery.commands, answer: live ? answer(live.events) : null }, {
    userInvocableCommandDiscovered: hasName(discovery.commands, 'argument-echo'),
    hiddenUserCommandExcludedFromMenu: !hasName(discovery.commands, 'hidden-echo'),
    directCommandInventoryDoesNotProveModelInvocationPermission: (discovery.init?.skills ?? []).includes('argument-echo'),
    ...(live ? { directDispatchPreservesExactArgument: answer(live.events).trim() === 'EXACT_ARGUMENT=' + token } : {}),
  }, { discovery, live }, 'Frontmatter disables model-initiated selection while preserving explicit user invocation. Live mode sends a slash command with a fresh random argument and checks the exact substituted result.');
}
