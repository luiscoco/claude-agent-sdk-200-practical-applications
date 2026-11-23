import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveSettings } from '@anthropic-ai/claude-agent-sdk';
import { conversation } from './conversation.js';
import { report } from './native.js';
export async function run(mode: string) {
  const directory = path.join(process.env.LAB_WORKSPACE!, '.claude'); await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'settings.local.json'); await writeFile(file, JSON.stringify({ outputStyle: 'default' }));
  const experiment = await conversation({ settingSources: ['project', 'local'] }, async host => {
    await host.runtime.applyFlagSettings({ outputStyle: 'Explanatory' });
    const unchangedAfterFlag = JSON.parse(await readFile(file, 'utf8')).outputStyle;
    await host.runtime.updateSettings('localSettings', { outputStyle: 'Learning' });
    const persisted = JSON.parse(await readFile(file, 'utf8'));
    const nextSession = await resolveSettings({ cwd: process.env.LAB_WORKSPACE, settingSources: ['project', 'local'] });
    const nextTurn = mode === 'live' ? await host.send('Explain idempotency in one concise paragraph.', true) : null;
    return { unchangedAfterFlag, persisted, futureSessionOutputStyle: nextSession.effective.outputStyle, nextTurn };
  });
  return report(experiment.value, { flagChangeDoesNotPersistToFile: experiment.value.unchangedAfterFlag === 'default',
    explicitFileUpdatePersists: experiment.value.persisted.outputStyle === 'Learning',
    futureSessionResolverSeesPersistedSetting: experiment.value.futureSessionOutputStyle === 'Learning',
    ...(mode === 'live' ? { actualNextTurnCompleted: experiment.value.nextTurn?.result.num_turns > 0 } : {}),
  }, experiment, 'applyFlagSettings changes the active flag layer; updateSettings writes an allowed key to an owned local settings file. resolveSettings verifies future-session configuration, not every active model-side behavior.');
}
