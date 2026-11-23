import path from 'node:path';
import { spawn } from 'node:child_process';
import { appendTypeScript } from './typescript-probe.js';
import { requestSchema } from './persistence.js';
import { publicReport } from './privacy.js';
const root = path.resolve(import.meta.dirname, '..');
async function jsonProcess(executable: string, args: string[]) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDE_CODE_SKIP_PROMPT_HISTORY;
    const child = spawn(executable, args, {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new Error(
          'Persistence helper timed out. Check the configured Python environment and available memory.',
        ),
      );
    }, 120000);
    let stdout = '',
      stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (text) => (stdout += text));
    child.stderr.on('data', (text) => (stderr += text));
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new Error(
            'Persistence helper failed. For Python profiles configure PYTHON_PATH and install requirements-lock.txt. ' +
              stderr,
          ),
        );
        return;
      }
      try {
        resolve({ ...JSON.parse(stdout.trim()), observedProcessId: child.pid, exitCode: code });
      } catch {
        reject(new Error('Persistence helper returned invalid JSON.'));
      }
    });
  });
}
export async function runPersistence(value: unknown) {
  const requestedInput = requestSchema.parse(value),
    profiles: Array<Record<string, any>> = [];
  if (requestedInput.mode !== 'typescript' && !process.env.PYTHON_PATH?.trim())
    throw new Error(
      'Configure PYTHON_PATH with the interpreter from your pinned Python SDK environment before running Python profiles.',
    );
  for (const language of requestedInput.mode === 'compare'
    ? ['typescript', 'python']
    : [requestedInput.mode]) {
    for (const persist of [true, false]) {
      const profile: Record<string, any> =
        language === 'typescript'
          ? await appendTypeScript(persist, requestedInput.topic)
          : await jsonProcess(process.env.PYTHON_PATH || 'python', [
              'src/python-probe.py',
              persist ? 'default' : 'disabled',
              requestedInput.topic,
            ]);
      if (!profile.workspace || !profile.actualSessionId)
        throw new Error(profile.error || 'The native persistence profile did not initialize.');
      profile.history = await jsonProcess(process.execPath, [
        '--import',
        'tsx',
        'src/history-reader.ts',
        profile.workspace,
        profile.actualSessionId,
        profile.promptId,
        profile.marker,
      ]);
      profile.checks = {
        actualNativeTranscriptOnlyRunSucceeded: profile.success && !profile.error,
        actualInitAndResultMatchRequestedSession:
          profile.actualSessionId === profile.requestedSessionId &&
          profile.actualResultSessionId === profile.requestedSessionId,
        noAssistantModelTurn:
          profile.turns === 0 &&
          profile.costUsd === 0 &&
          profile.durationApiMs === 0 &&
          profile.assistantMessageCount === 0,
        nativeTranscriptPresenceMatchesControl:
          profile.history.transcripts.length === (persist ? 1 : 0),
        originalUserAppendPresenceMatchesControl:
          profile.history.transcripts.some((file: any) => file.exactUserAppendFound) === persist,
        independentNativeReaderMatchesControl:
          profile.history.exactMarkerFoundByNativeReader === persist &&
          (persist
            ? profile.history.nativeMessages.length > 0
            : profile.history.nativeMessages.length === 0),
        separateHostFileRemains: profile.history.noteRemains,
      };
      profile.verified = Object.values(profile.checks).every(Boolean);
      profiles.push(profile);
    }
  }
  const checks = {
    freshNativeSessionsAreDistinct:
      new Set(profiles.map((profile) => profile.actualSessionId)).size === profiles.length,
    allExpectedLanguageProfilesRan: profiles.length === (requestedInput.mode === 'compare' ? 4 : 2),
    allActualNativePersistenceChecksPassed: profiles.every((profile) => profile.verified),
    actualSDKOptionDifferenceMatches: profiles.every(
      (profile) => profile.firstClassPersistOption === (profile.language === 'TypeScript'),
    ),
  };
  return publicReport(
    {
      requestedInput,
      profiles,
      output: {
        profiles: profiles.length,
        persisted: profiles.filter((profile) => profile.history.transcripts.length > 0).length,
        assistantTurns: profiles.reduce((sum, profile) => sum + profile.turns, 0),
        totalCostUsd: profiles.reduce((sum, profile) => sum + profile.costUsd, 0),
      },
      fixtureDisclosure:
        'Fresh owned transcript-only appends using shouldQuery:false. Actual SDK initialization, completion and local history reads; no assistant model turn. The caller assigns a supported session UUID and verifies the native messages use it. A separate host-created note demonstrates file scope.',
      checks,
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY, process.env.INWORLD_API_KEY],
  );
}
