import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as sdk from '@anthropic-ai/claude-agent-sdk';
import { inspect } from './capabilities.js';
import { report } from './native.js';
export async function run(mode: string) {
  const require = createRequire(import.meta.url), directory = path.dirname(require.resolve('@anthropic-ai/claude-agent-sdk'));
  const declarations = await readFile(path.join(directory, 'sdk.d.ts'), 'utf8'), installed = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  const methods = [...declarations.slice(declarations.indexOf('export declare interface Query '), declarations.indexOf('export declare function query')).matchAll(/^    ([A-Za-z]\w*)\([^;]*?\):/gm)].map(match => match[1]);
  const functions = [...declarations.matchAll(/export declare function (\w+)/g)].map(match => match[1]);
  const snapshot = JSON.parse(await readFile(path.resolve(import.meta.dirname, '../course-inventory.json'), 'utf8'));
  const references = [...functions.map(name => ({ kind: 'function', name })), ...methods.map(name => ({ kind: 'Query method', name }))].map(capability => ({ ...capability, sourceReferences: snapshot.references[capability.name] || [], status: snapshot.references[capability.name]?.length ? 'source_reference_requires_behavioral_review' : 'unmapped_requires_example' }));
  const observed = await inspect({}, async runtime => ({ initialization: await runtime.initializationResult(), mcp: await runtime.mcpServerStatus() }));
  let live: any = null; if (mode === 'live') { const { native, requireNative } = await import('./native.js'); live = await native('Explain why source references alone cannot certify complete SDK feature coverage.', {}, true); requireNative(live, false); }
  return report({ installedSdk: installed.version, publicRuntimeExports: Object.keys(sdk), publicFunctions: functions, publicQueryMethods: methods, courseInventorySnapshot: snapshot.lessons, capabilityReferences: references, unmapped: references.filter(row => row.status === 'unmapped_requires_example'), allCapabilitiesCertified: false, snapshotDate: snapshot.generatedAt }, { installedReferenceRead: declarations.includes('interface Query'), allLessonFoldersInSnapshot: snapshot.lessons.length === 200 && snapshot.lessons.every((row: any) => row.application), runnableAuditControls: Boolean(observed), noFalseCertification: true }, { observed, live }, 'Reproducible audit against installed public function/Query declarations and a dated bundled course inventory. Option/type fields and alternate entrypoints require additional review; references do not prove behavioral coverage. Unmapped capabilities remain explicit work items.');
}
