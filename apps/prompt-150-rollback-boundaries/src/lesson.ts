import { InMemorySessionStore } from '@anthropic-ai/claude-agent-sdk';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { conversation, toolCalls } from './conversation.js';
import { native, report } from './native.js';
const exec = promisify(execFile);
export async function run(mode: string) {
  const tracked = path.join(process.env.LAB_WORKSPACE!, 'tracked.txt'), external = path.join(process.env.LAB_WORKSPACE!, 'process-change.txt'), delegated = path.join(process.env.LAB_WORKSPACE!, 'delegated.txt');
  await writeFile(tracked, 'ORIGINAL'); await writeFile(external, 'ORIGINAL'); await writeFile(delegated, 'ORIGINAL');
  const conflict = await native('Owned incompatible configuration probe.', { enableFileCheckpointing: true, sessionStore: new InMemorySessionStore() });
  const observed = await conversation({ enableFileCheckpointing: true, extraArgs: { 'replay-user-messages': null }, tools: ['Read', 'Edit', 'Agent', 'Write'],
    agents: { writer: { description: 'Write one owned delegated file.', prompt: 'Write only the file named in your task.', tools: ['Write'], maxTurns: 2 } },
    canUseTool: async (name, input) => name === 'Agent' || (typeof input.file_path === 'string' && [tracked, delegated].includes(path.resolve(input.file_path)))
      ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Use only the owned checkpoint fixtures.' } }, async host => {
    await exec(process.execPath, ['-e', "require('node:fs').writeFileSync(process.argv[1], 'PROCESS_CHANGE')", external], { windowsHide: true });
    if (mode !== 'live') return { externalAfterProcess: await readFile(external, 'utf8'), baselinePreview: await host.runtime.rewindFiles(host.baseline.promptId, { dryRun: true }) };
    const turn = await host.send(`Read ${tracked} and Edit ORIGINAL to MAIN_EDIT. Also delegate to writer to Write SUBAGENT_EDIT into ${delegated}. Wait for both edits.`, true);
    const beforeRewind = { tracked: await readFile(tracked, 'utf8'), external: await readFile(external, 'utf8'), delegated: await readFile(delegated, 'utf8') };
    const rewind = await host.runtime.rewindFiles(turn.promptId);
    return { turn, beforeRewind, rewind, afterRewind: { tracked: await readFile(tracked, 'utf8'), external: await readFile(external, 'utf8'), delegated: await readFile(delegated, 'utf8') } };
  });
  const value = observed.value as any;
  return report({ storageConflict: conflict.error, ...value }, {
    externalStoreCheckpointConflictRejectedBySdk: !conflict.success && /checkpoint/i.test(conflict.error || ''),
    ...(mode === 'live' ? { mainEditActuallyObserved: toolCalls(value.turn.events, 'Edit').length > 0,
      mainFileRestored: value.beforeRewind.tracked === 'MAIN_EDIT' && value.afterRewind.tracked === 'ORIGINAL',
      childProcessChangeNotRolledBack: value.afterRewind.external === 'PROCESS_CHANGE',
      actualSubagentEditNotRolledBack: value.beforeRewind.delegated === 'SUBAGENT_EDIT' && value.afterRewind.delegated === 'SUBAGENT_EDIT' }
      : { actualChildProcessWritesOutsideSdkTracking: value.externalAfterProcess === 'PROCESS_CHANGE' }),
  }, { observed, conflict }, 'The experiment separates main-loop tracked edits, a host child-process write, a delegated file edit, and the unsupported external-store/checkpoint combination. No real external service is contacted; a filesystem rewind is not a transaction over external side effects.');
}
