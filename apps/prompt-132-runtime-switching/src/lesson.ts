import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { conversation } from './conversation.js';
import { report } from './native.js';
export async function run(mode: string) {
  const file = path.join(process.env.LAB_WORKSPACE!, 'owned.txt'); await writeFile(file, 'ORIGINAL');
  const experiment = await conversation({ tools: ['Read', 'Write'], canUseTool: async (_name, input) =>
    typeof input.file_path === 'string' && path.resolve(input.file_path) === file
      ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Only the owned fixture is permitted.' } }, async host => {
    const models = await host.runtime.supportedModels();
    const target = process.env.CLAUDE_COMPARISON_MODEL || models.find(m => /haiku/i.test(m.value))?.value || models.find(m => /sonnet/i.test(m.value))?.value;
    if (!target) throw new Error('No suitable model was advertised.');
    const before = mode === 'live' ? await host.send('Reply with BEFORE_SWITCH.', true) : null;
    await host.runtime.setModel(target); await host.runtime.setPermissionMode('plan');
    const after = await host.send(mode === 'live' ? 'You are now in plan mode. Do not edit files. Reply with AFTER_SWITCH.' : 'Record the local control change without model inference.', mode === 'live');
    const actualModels = after.events.filter(e => e.type === 'assistant').map(e => e.message.model);
    return { advertisedModels: models.map(m => ({ value: m.value, resolvedModel: m.resolvedModel })), target, before, after, actualModels };
  });
  const target = experiment.value.target, ids = experiment.value.actualModels;
  return report(experiment.value, { actualControlRequestsCompleted: Boolean(target),
    planModeLeftOwnedFileUnchanged: await readFile(file, 'utf8') === 'ORIGINAL',
    ...(mode === 'live' ? { nextTurnUsesSelectedModel: ids.some(id => id === target || id.toLowerCase().includes(target.toLowerCase())),
      nextTurnActuallyRan: experiment.value.after.result.num_turns > 0 } : {}),
  }, experiment, 'Model and permission changes are sent to one held-open native conversation. Live evidence inspects actual assistant model IDs on the next turn; accepting a setModel request alone is not proof of model execution.');
}
