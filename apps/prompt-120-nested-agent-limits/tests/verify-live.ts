import 'dotenv/config';
import { launch } from '../src/launch.js';
import { writeFile } from 'node:fs/promises';
const startedAt = new Date().toISOString(); let verification: any;
try { const observed = await launch('live'); verification = { number: 120, startedAt, status: observed.verified ? 'passed' : 'failed', observed }; }
catch (error) { let message = error instanceof Error ? error.message : String(error); for (const secret of [process.env.ANTHROPIC_API_KEY, process.env.CLAUDE_CODE_OAUTH_TOKEN]) if (secret) message = message.replaceAll(secret, '[REDACTED]'); verification = { number: 120, startedAt, status: /auth|login|logged in|credit|balance|API.key|401|403/i.test(message) ? 'unavailable' : 'failed', error: message }; }
verification.finishedAt = new Date().toISOString(); await writeFile('verification-live.json', JSON.stringify(verification, null, 2)); console.log(JSON.stringify({ number: 120, status: verification.status, error: verification.error, checks: verification.observed?.checks })); if (verification.status !== 'passed') process.exitCode = 1;
