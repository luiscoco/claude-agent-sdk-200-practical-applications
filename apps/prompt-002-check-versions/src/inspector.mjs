import path from 'node:path';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const execute = promisify(execFile);
const features = [
  ['outputFormat', 'Structured output', 'https://code.claude.com/docs/en/agent-sdk/structured-outputs'],
  ['includePartialMessages', 'Partial-message streaming', 'https://code.claude.com/docs/en/agent-sdk/streaming-output'],
  ['hooks', 'Lifecycle hooks', 'https://code.claude.com/docs/en/agent-sdk/hooks'],
  ['canUseTool', 'Tool permission callback', 'https://code.claude.com/docs/en/agent-sdk/permissions'],
  ['settingSources', 'Filesystem settings sources', 'https://code.claude.com/docs/en/agent-sdk/configuration'],
  ['fallbackModel', 'Fallback model option', 'https://code.claude.com/docs/en/agent-sdk/typescript']
];

export async function inspectRuntime(expectedVersion = '') {
  const expected = expectedVersion.trim();
  if (expected && !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(expected)) {
    throw new Error('Enter an exact SDK version such as 0.3.322, or leave the field empty.');
  }

  // Resolve the dependency used by this application, rather than a global CLI.
  const sdkDirectory = path.dirname(require.resolve('@anthropic-ai/claude-agent-sdk'));
  const sdk = JSON.parse(await readFile(path.join(sdkDirectory, 'package.json'), 'utf8'));
  const nativePackage = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
  const nativeDirectory = path.resolve(sdkDirectory, '..', nativePackage.split('/')[1]);
  const executable = path.join(nativeDirectory, process.platform === 'win32' ? 'claude.exe' : 'claude');
  let binary;
  try {
    binary = await execute(executable, ['--version'], {
      windowsHide: true,
      timeout: 20_000,
      maxBuffer: 64 * 1024
    });
  } catch (error) {
    throw new Error(`Could not execute the bundled runtime for ${process.platform}/${process.arch}. Reinstall npm optional dependencies and retry. ${error.code || 'RUNTIME_ERROR'}`);
  }
  const observed = binary.stdout.trim();
  const runtimeVersion = observed.match(/\b\d+\.\d+\.\d+(?:-[\w.-]+)?\b/)?.[0];
  if (!runtimeVersion) throw new Error('The runtime did not return a recognizable version.');

  const declarationFile = path.join(sdkDirectory, 'sdk.d.ts');
  const lines = (await readFile(declarationFile, 'utf8')).split(/\r?\n/);
  const optionsStart = lines.findIndex(line => line.includes('export declare type Options = {'));
  if (optionsStart < 0) throw new Error('Cannot locate Options in this installed SDK declaration file. Review the inspector for this release.');
  const optionsEnd = lines.findIndex((line, index) => index > optionsStart && line === '};');
  if (optionsEnd < 0) throw new Error('Cannot locate the end of the Options declaration.');
  const declarations = features.map(([field, label, documentation]) => {
    const pattern = new RegExp(`^\\s*${field}\\??:`);
    const lineIndex = lines.findIndex((line, index) => index > optionsStart && index < optionsEnd && pattern.test(line));
    return {
      field, label, documentation,
      status: lineIndex >= 0 ? 'Declared' : 'Absent',
      file: 'sdk.d.ts',
      line: lineIndex >= 0 ? lineIndex + 1 : null,
      declaration: lineIndex >= 0 ? lines[lineIndex].trim() : null
    };
  });

  const checks = [
    { label: 'SDK package located', passed: true, evidence: `${sdk.name}@${sdk.version}` },
    { label: 'Bundled runtime executed', passed: true, evidence: observed },
    { label: 'Runtime matches package metadata', passed: runtimeVersion === sdk.claudeCodeVersion, evidence: `Declared ${sdk.claudeCodeVersion}, observed ${runtimeVersion}` }
  ];
  if (expected) checks.push({ label: 'SDK matches expected version', passed: sdk.version === expected, evidence: `Expected ${expected}, installed ${sdk.version}` });
  return {
    inspectedAt: new Date().toISOString(),
    status: checks.every(check => check.passed) ? 'passed' : 'mismatch',
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    sdk: { name: sdk.name, version: sdk.version, requiredNode: sdk.engines.node, declaredRuntimeVersion: sdk.claudeCodeVersion },
    runtime: { version: runtimeVersion, output: observed, executable },
    expectedVersion: expected || null,
    checks,
    capabilities: declarations,
    scope: 'Version execution and installed type-declaration inspection. Feature behavior requires its own runnable test.'
  };
}
