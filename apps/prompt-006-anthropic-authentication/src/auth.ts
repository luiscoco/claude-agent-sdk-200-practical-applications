import path from 'node:path';
import { config } from 'dotenv';

const root = path.resolve(import.meta.dirname, '..');
export class AuthConfigurationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export function resolveConfiguration(
  mode: string,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
  dotenvPath = path.join(root, '.env')
) {
  if (!['environment', 'dotenv', 'blank'].includes(mode)) {
    throw new AuthConfigurationError('INVALID_MODE', 'Choose environment, dotenv or the blank configuration example.');
  }
  const environment: Record<string,string> = mode === 'blank' ? {} : Object.fromEntries(
    Object.entries(baseEnvironment).filter((entry): entry is [string,string] => typeof entry[1] === 'string')
  );
  if (!environment.ANTHROPIC_API_KEY?.trim()) delete environment.ANTHROPIC_API_KEY;
  const inheritedKey = !!environment.ANTHROPIC_API_KEY?.trim();
  let loadedVariables: string[] = [];
  let sourceFile: string | null = null;
  if (mode !== 'environment') {
    const file = mode === 'blank' ? path.join(root, 'fixtures/blank.env') : dotenvPath;
    const loaded = config({path:file, processEnv:environment, quiet:true, override:false});
    if (loaded.error) {
      throw new AuthConfigurationError('ENV_FILE_UNAVAILABLE', 'Create the project .env from .env.example and configure it locally.');
    }
    loadedVariables = Object.keys(loaded.parsed || {});
    sourceFile = mode === 'blank' ? 'fixtures/blank.env' : path.basename(file);
  }
  const keyPresent = !!environment.ANTHROPIC_API_KEY?.trim();
  const summary = {
    mode, keyPresent,
    credentialOrigin: inheritedKey ? 'Process environment' : keyPresent ? 'Project dotenv file' : 'Missing',
    dotenvLoaded: mode !== 'environment', sourceFile, loadedVariables,
    model: environment.CLAUDE_MODEL || 'claude-sonnet-4-6'
  };
  return {environment, summary};
}

export function requireCredentials(configuration: ReturnType<typeof resolveConfiguration>) {
  if (!configuration.summary.keyPresent) {
    throw new AuthConfigurationError('MISSING_CREDENTIALS', 'ANTHROPIC_API_KEY is missing. Configure it in the process environment or your local .env file, then retry.');
  }
}

export function inspectAuthentication(mode: string) {
  const configuration = resolveConfiguration(mode);
  requireCredentials(configuration);
  return configuration.summary;
}
