import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { conversation, toolCalls } from './conversation.js';
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk';
export async function checkpointExperiment(live: boolean, resumeAndRestore = false) {
  const file = path.join(process.env.LAB_WORKSPACE!, 'tracked.txt'); await writeFile(file, 'State: ORIGINAL\n');
  const options = { enableFileCheckpointing: true, extraArgs: { 'replay-user-messages': null }, tools: ['Read', 'Edit'],
    canUseTool: async (name: string, input: Record<string, unknown>) => ['Read', 'Edit'].includes(name) && typeof input.file_path === 'string' && path.resolve(input.file_path) === file
      ? { behavior: 'allow' as const, updatedInput: input } : { behavior: 'deny' as const, message: 'Only the owned tracked fixture is permitted.' } };
  const first = await conversation(options, async host => {
    const id = host.baseline.promptId;
    if (!live) return { checkpointId: id, baselinePreview: await host.runtime.rewindFiles(id, { dryRun: true }), file, before: await readFile(file, 'utf8') };
    const edit = await host.send(`Read ${file}, then use Edit to replace ORIGINAL with EDITED. Do not use shell commands.`, true);
    const changed = await readFile(file, 'utf8');
    const preview = await host.runtime.rewindFiles(edit.promptId, { dryRun: true });
    const previewPreservedFile = await readFile(file, 'utf8') === changed;
    const beforeHistory = await getSessionMessages(edit.result.session_id);
    const rewind = resumeAndRestore ? null : await host.runtime.rewindFiles(edit.promptId);
    return { checkpointId: edit.promptId, file, edit, changed, preview, previewPreservedFile, rewind,
      beforeHistoryIds: beforeHistory.map(m => m.uuid), after: await readFile(file, 'utf8') };
  });
  let resumed = null;
  if (live && resumeAndRestore) resumed = await conversation({ ...options, resume: first.sessionId }, async host => {
    const rewind = await host.runtime.rewindFiles(first.value.checkpointId);
    const history = await getSessionMessages(first.sessionId);
    return { rewind, after: await readFile(file, 'utf8'), historyIds: history.map(m => m.uuid) };
  });
  return { first, resumed, file, actualModelEditObserved: live && toolCalls((first.value as any).edit?.events ?? [], 'Edit').length > 0 };
}
