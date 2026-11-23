import { native, requireNative, report } from './native.js';
import { inspect } from './capabilities.js';
import { toolCalls } from './conversation.js';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
export async function run(mode: string) {
  const file = path.join(process.env.LAB_WORKSPACE!, 'protected.txt'); await writeFile(file, 'PROTECTED');
  const discovery = await inspect({ tools: ['Read'] }); const denials: any[] = [];
  const live = mode === 'live' ? await native(`Use Write to change ${file} to CHANGED.`, { tools: ['Write'],
    canUseTool: async (name, input) => { denials.push({ name, input }); return { behavior: 'deny', message: 'Owned classroom write is intentionally denied.' }; } }, true) : null;
  if (live) requireNative(live, false);
  return report({ exposedTools: discovery.init?.tools, hostDenials: denials,
    nativePermissionDenials: live?.events.filter(e => e.type === 'result').flatMap(e => e.permission_denials ?? []),
    classification: 'Unavailable = absent inventory; denied = actual permission decision; failed = executed tool error; skipped = no observed invocation, not an inferred denial.' }, {
    unavailableWriteActuallyAbsent: !(discovery.init?.tools ?? []).includes('Write'),
    protectedOwnedFileUnchanged: await readFile(file, 'utf8') === 'PROTECTED',
    ...(live ? { actualPermissionCallbackDeniedAttempt: denials.length > 0 && toolCalls(live.events, 'Write').length > 0 } : {}),
  }, { discovery, live }, 'The live model must actually attempt the denied action before denial is claimed. A model choosing not to call a tool is not misclassified as a permissions failure.');
}
