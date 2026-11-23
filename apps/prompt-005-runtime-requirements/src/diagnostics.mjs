import path from 'node:path';
import { createRequire } from 'node:module';
import { readFile, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');

export function meetsMinimum(version, requirement) {
  const minimum = requirement.match(/^>=\s*(\d+)\.(\d+)(?:\.(\d+))?$/);
  const current = version.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!minimum || !current) return null;
  for (let index = 1; index <= 3; index++) {
    const difference = Number(current[index]) - Number(minimum[index] || 0);
    if (difference) return difference > 0;
  }
  return true;
}

async function describeTypeScript() {
  const sdkDirectory = path.dirname(require.resolve('@anthropic-ai/claude-agent-sdk'));
  const sdk = JSON.parse(await readFile(path.join(sdkDirectory, 'package.json'), 'utf8'));
  const musl = process.platform === 'linux' && !process.report.getReport().header.glibcVersionRuntime;
  const packageName = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}${musl ? '-musl' : ''}`;
  const packageDirectory = path.resolve(sdkDirectory, '..', packageName.split('/')[1]);
  return {
    language: 'Node.js', version: process.versions.node, sdkVersion: sdk.version,
    required: sdk.engines.node, platform: process.platform, architecture: process.arch,
    nativePackage: packageName, declaredPackage: !!sdk.optionalDependencies?.[packageName],
    executable: path.join(packageDirectory, process.platform === 'win32' ? 'claude.exe' : 'claude')
  };
}

async function describePython() {
  const python = process.env.PYTHON_EXECUTABLE;
  if (!python) throw new Error('Set PYTHON_EXECUTABLE to your environment interpreter, then restart the application.');
  const script = [
    'import sys, platform, json, importlib.metadata as metadata',
    'distribution = metadata.distribution("claude-agent-sdk")',
    'binary = next((file for file in distribution.files if file.name in ("claude.exe", "claude")), None)',
    'print(json.dumps({"language":"Python", "version":platform.python_version(), "sdkVersion":distribution.version, "required":distribution.metadata["Requires-Python"], "platform":sys.platform, "architecture":platform.machine(), "interpreter":sys.executable, "isolated":sys.prefix != sys.base_prefix, "executable":str(distribution.locate_file(binary)) if binary else None}))'
  ].join('\n');
  const result = await execute(python, ['-c', script], {windowsHide:true, timeout:20000, maxBuffer:65536});
  return JSON.parse(result.stdout);
}

export async function diagnoseRuntime({language = 'typescript', missingBinary = false} = {}) {
  if (!['typescript', 'python'].includes(language)) throw new Error('Choose TypeScript or Python.');
  if (typeof missingBinary !== 'boolean') throw new Error('missingBinary must be a boolean.');
  const environment = language === 'python' ? await describePython() : await describeTypeScript();
  const checks = [];
  const minimum = meetsMinimum(environment.version, environment.required);
  checks.push({
    label: 'Language meets installed package requirements', status: minimum === true ? 'passed' : minimum === false ? 'failed' : 'review',
    evidence: `${environment.language} ${environment.version}; package requires ${environment.required}`,
    remedy: minimum === true ? null : 'Use an interpreter satisfying the installed package requirement.'
  });
  checks.push({
    label: 'Observed operating system and architecture', status: 'observed',
    evidence: `${environment.platform}/${environment.architecture}`, remedy: null
  });
  if (language === 'typescript') checks.push({
    label: 'SDK declares a native package for this platform', status: environment.declaredPackage ? 'passed' : 'failed',
    evidence: environment.nativePackage,
    remedy: environment.declaredPackage ? null : 'Check the SDK documentation for a supported native installation or an explicit executable path.'
  });

  const selected = missingBinary ? path.join(root, 'fixtures', 'missing-runtime', 'claude.exe') : environment.executable;
  let exists = false;
  if (selected) { try { await access(selected); exists = true; } catch {} }
  checks.push({
    label: 'Selected Claude Code executable exists', status: exists ? 'passed' : 'failed',
    evidence: selected || 'This SDK installation contains no bundled executable.',
    remedy: exists ? null : missingBinary ? 'The selected missing-file example is absent. Select the installed runtime and inspect again.' : 'Reinstall the platform package with optional dependencies enabled, or configure a supported native executable.'
  });

  let output = null;
  if (exists) {
    try {
      const result = await execute(selected, ['--version'], {windowsHide:true, timeout:20000, maxBuffer:65536});
      output = result.stdout.trim();
      checks.push({label:'Native runtime starts successfully',status:'passed',evidence:output,remedy:null});
    } catch (error) {
      checks.push({label:'Native runtime starts successfully',status:'failed',evidence:error.code || 'Launch failed',remedy:'Check executable permissions, architecture and the selected native installation.'});
    }
  }
  return {
    inspectedAt: new Date().toISOString(),
    status: checks.some(check => ['failed','review'].includes(check.status)) ? 'attention' : 'passed',
    environment, selectedExecutable: selected, runtimeOutput: output,
    scenario: missingBinary ? 'Missing executable example' : 'Installed runtime', checks
  };
}
