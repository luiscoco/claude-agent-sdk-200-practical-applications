import { native, requireNative, report } from './native.js';
export function migrate(source: string) {
  if (/unstable_v2_|createSession|resumeSession|\.send\(/.test(source)) return { migrated: null, manual: 'Removed TypeScript V2 API: replace session.send/stream lifecycle with query({prompt: asyncIterable, options:{resume}}). Review ownership, cancellation and result boundaries manually.' };
  return { migrated: source.replace(/from\s+(['"])@anthropic-ai\/claude-code\1/g, 'from $1@anthropic-ai/claude-agent-sdk$1'), manual: null };
}
export async function run(mode: string) {
  const old = `import { query } from '@anthropic-ai/claude-code';`, converted = migrate(old), removed = migrate('const session=unstable_v2_createSession(); session.send(prompt);');
  const observed = await native(mode === 'live' ? 'Briefly explain one migration verification step.' : 'Migrated supported query lifecycle executes through current pinned SDK.', {}, mode === 'live'); requireNative(observed, mode !== 'live');
  return report({ before: old, after: converted, removedApi: removed, supportedReplacement: 'Use native.ts: actual query, AsyncGenerator input, explicit resume, drained output and finally close.', pythonRename: 'claude-code-sdk → claude-agent-sdk' }, { supportedImportRenamed: converted.migrated?.includes("from '@anthropic-ai/claude-agent-sdk'") === true, removedApiNotBlindlyRenamed: removed.migrated === null && Boolean(removed.manual), supportedLifecycleExecuted: observed.success }, observed, 'Finite import migration example and explicit manual gate for removed V2 semantics. This transform is not a general TypeScript codemod and does not edit arbitrary source files.');
}
