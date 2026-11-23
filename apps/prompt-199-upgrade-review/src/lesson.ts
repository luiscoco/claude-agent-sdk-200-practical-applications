import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as sdk from '@anthropic-ai/claude-agent-sdk';
import { native, requireNative, report } from './native.js';
export async function run(mode: string) {
  const require = createRequire(import.meta.url), directory = path.dirname(require.resolve('@anthropic-ai/claude-agent-sdk')), pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const observed = await native(mode === 'live' ? 'State one focused compatibility check before upgrading an agent SDK.' : 'Upgrade compatibility baseline: init, transcript persistence and final result.', {}, mode === 'live'); requireNative(observed, mode !== 'live');
  const reviewed = JSON.parse(await readFile(path.resolve(import.meta.dirname, '../upgrade-review.json'), 'utf8'));
  const init = observed.events.find(e => e.type === 'system' && e.subtype === 'init');
  return report({ installedSdk: pkg.version, installedNativeRuntime: init?.claude_code_version, reviewed, focusedChecks: { queryExport: typeof sdk.query === 'function', toolFactory: typeof sdk.tool === 'function', sessionStoreImport: typeof sdk.importSessionToStore === 'function', nativeSessionIdentity: observed.sessionId === observed.resultSessionId }, upgradeApplied: false }, { pinnedInstalledVersion: pkg.version === '0.3.322', resultBoundaryCompatible: observed.success, reviewedCandidateExplicit: reviewed.candidateSdk === '0.3.330', coreFactoriesPresent: typeof sdk.query === 'function' && typeof sdk.createSdkMcpServer === 'function' }, observed, 'Pinned baseline tested without upgrading dependencies. Changelog candidate is a dated review snapshot, not a permanent latest-version claim. Run the same suite in a separate checkout with the candidate before adoption.');
}
