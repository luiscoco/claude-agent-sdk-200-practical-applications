import { randomUUID } from 'node:crypto';
import { cleanEnvironment } from './application.js';
import { child, exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const syntheticCredential = randomUUID();
  const previous = process.env.PRIVATE_SERVICE_TOKEN; process.env.PRIVATE_SERVICE_TOKEN = syntheticCredential;
  let environment: NodeJS.ProcessEnv;
  try { environment = cleanEnvironment(process.env.LAB_WORKSPACE!); }
  finally { if (previous === undefined) delete process.env.PRIVATE_SERVICE_TOKEN; else process.env.PRIVATE_SERVICE_TOKEN = previous; }
  const probe = await child(['-e', 'console.log(JSON.stringify({credentialPresent:Boolean(process.env.PRIVATE_SERVICE_TOKEN)}))'], { env: environment });
  let hostUses = 0;
  const evidence = await exercise(mode, 'Get the support service status through the credential-holding host tool.', async input => { if (input !== 'status') throw new Error('Operation denied'); if (!syntheticCredential) throw new Error('Missing host credential'); hostUses++; return { status: 'healthy', source: 'owned-service-fixture' }; }, 'status');
  return report({ childCredentialPresent: JSON.parse(probe.stdout).credentialPresent, hostUses, fixture: 'Synthetic service credential held only in host closure' }, { strippedExecutableEnvironment: !JSON.parse(probe.stdout).credentialPresent && !('PRIVATE_SERVICE_TOKEN' in environment), controlledHostCall: hostUses > 0, credentialNotInToolResult: !JSON.stringify(evidence).includes(syntheticCredential) }, evidence, 'Service credential separation using a controlled tool closure. The fixture is synthetic. Model-provider authentication is a separate credential and is not a substitute for service authorization.');
}
