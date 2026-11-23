import { native, requireNative, report } from './native.js';
import { inspect } from './capabilities.js';
type Route = 'bedrock' | 'anthropic-aws' | 'vertex';
const routes = {
  bedrock: { flag: 'CLAUDE_CODE_USE_BEDROCK', required: ['AWS_REGION', 'BEDROCK_MODEL_ID'], source: 'https://code.claude.com/docs/en/amazon-bedrock', description: 'Amazon-operated Bedrock model access, IAM and AWS billing. Model/inference-profile IDs are Bedrock-specific; direct Anthropic keys do not grant access.' },
  'anthropic-aws': { flag: 'CLAUDE_CODE_USE_ANTHROPIC_AWS', required: ['AWS_REGION', 'ANTHROPIC_AWS_WORKSPACE_ID'], source: 'https://code.claude.com/docs/en/claude-platform-on-aws', description: 'Anthropic-operated API with AWS authentication and AWS Marketplace billing. Requires an AWS-linked Anthropic workspace; existing Console organization credentials do not transfer.' },
  vertex: { flag: 'CLAUDE_CODE_USE_VERTEX', required: ['CLOUD_ML_REGION', 'ANTHROPIC_VERTEX_PROJECT_ID', 'VERTEX_MODEL_ID'], source: 'https://code.claude.com/docs/en/google-vertex-ai', description: 'Google Cloud Agent Platform / Vertex-related settings, Google project, IAM, ADC and provider-specific model IDs. Feature availability must be verified for the selected region/model.' },
};
export function diagnose(route: Route, env: NodeJS.ProcessEnv) {
  const config = routes[route], missing = config.required.filter(key => !env[key]?.trim());
  const flags = ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_ANTHROPIC_AWS', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY'];
  const conflicts = flags.filter(key => key !== config.flag && env[key] === '1');
  return { missing, conflicts, readyForCredentialAttempt: missing.length === 0 && conflicts.length === 0, credentialsVerified: false, modelAccessVerified: false };
}
export async function providerRun(route: Route, mode: string) {
  const config = routes[route], current = diagnose(route, process.env);
  const fixture = Object.fromEntries(config.required.map(key => [key, 'owned-config-fixture']));
  const valid = diagnose(route, fixture), invalid = diagnose(route, {}), conflict = diagnose(route, { ...fixture, CLAUDE_CODE_USE_FOUNDRY: '1' });
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_ANTHROPIC_AWS', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_BASE_URL']) delete env[key];
  let account: any = null;
  if (mode === 'live') {
    if (!current.readyForCredentialAttempt) throw new Error('Provider configuration unavailable: ' + JSON.stringify(current));
    env[config.flag] = '1';
    account = (await inspect({ env }, runtime => runtime.accountInfo())).change;
  }
  const model = route === 'bedrock' ? process.env.BEDROCK_MODEL_ID : route === 'vertex' ? process.env.VERTEX_MODEL_ID : process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
  const observed = await native(mode === 'live' ? 'Reply with PROVIDER-ACCESS-VERIFIED and explain one provider-specific deployment consideration.' : 'Provider diagnostic fixture without cloud inference.', { env, ...(mode === 'live' ? { model } : {}) }, mode === 'live'); requireNative(observed, mode !== 'live');
  const identity = String((account as any)?.apiProvider || '').toLowerCase();
  const providerMatched = route === 'bedrock' ? identity.includes('bedrock') : route === 'vertex' ? /vertex|google/.test(identity) : /anthropic.*aws|aws.*anthropic/.test(identity);
  return report({ route, description: config.description, configuration: current, account, credentialDiscovery: route === 'vertex' ? 'Google ADC; file or attached identity. Presence does not prove access.' : route === 'anthropic-aws' ? 'ANTHROPIC_AWS_API_KEY or AWS credential chain/SigV4; secrets never displayed.' : 'AWS credential chain or configured Bedrock bearer token; actual access requires a live inference.', modelAccess: mode === 'live' ? 'Actual successful inference observed; review account identity.' : 'not attempted', source: config.source }, { validConfigurationRecognized: valid.readyForCredentialAttempt, missingConfigurationDiagnosed: invalid.missing.length === config.required.length, conflictingRouteRejected: conflict.conflicts.length === 1, nativeScenarioSucceeded: observed.success, liveProviderIdentityConfirmed: mode !== 'live' || providerMatched }, observed, 'Local checks validate configuration diagnostics, not cloud credentials/IAM/model access. Live mode uses the documented route and requires actual provider identity plus successful inference. No cloud resources are provisioned.');
}
