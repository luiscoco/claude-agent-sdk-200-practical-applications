import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { conversation, toolCalls } from './conversation.js';
import { report } from './native.js';
export async function run(mode: string) {
  const file = path.join(process.env.LAB_WORKSPACE!, 'owned.txt'); await writeFile(file, 'Status: ORIGINAL\n');
  const readAt = Math.floor((await stat(file)).mtimeMs), hostRead = await readFile(file, 'utf8');
  const observed = await conversation({ tools: ['Edit'], canUseTool: async (_name, input) => input.file_path === file
    ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'Edit only the owned fixture.' } }, async host => {
    await host.runtime.seedReadState(file, readAt);
    const edit = mode === 'live' ? await host.send(`The host read ${file}. Replace ORIGINAL with EDITED using Edit, without a Read call.`, true) : null;
    return { seededMtimeMs: readAt, edit, after: await readFile(file, 'utf8') };
  });
  return report({ hostRead, ...observed.value }, { actualReadStateControlAccepted: observed.value.seededMtimeMs === readAt,
    ...(mode === 'live' ? { actualEditWithoutModelRead: toolCalls(observed.value.edit!.events, 'Edit').length > 0,
      ownedContentActuallyChanged: observed.value.after === 'Status: EDITED\n' } : {}),
  }, observed, 'The host reads the owned file and seeds its observed floored modification time through the supported control. The native runtime validates stale timestamps; seeding is coordination, not an authorization bypass.');
}
