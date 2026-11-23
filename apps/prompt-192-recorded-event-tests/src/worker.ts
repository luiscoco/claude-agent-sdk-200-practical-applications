import { mkdir } from 'node:fs/promises';
import { prepareAuth } from './auth.js';
await mkdir(process.env.LAB_WORKSPACE!, { recursive: true });
if (process.argv[2] === 'live') await prepareAuth(process.env.CLAUDE_CONFIG_DIR!);
const { run } = await import('./lesson.js');
try {
  const result = await run(process.argv[2] || 'local');
  // Reports are classroom artifacts; redact known credential values before export.
  let json = JSON.stringify(result);
  for (const name of ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']) {
    const secret = process.env[name];
    if (secret) json = json.split(secret).join('[REDACTED]');
  }
  console.log(json);
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
