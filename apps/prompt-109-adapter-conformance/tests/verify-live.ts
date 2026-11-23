import 'dotenv/config';
import { launch } from '../src/launch.js';
import { writeFile } from 'node:fs/promises';
const startedAt = new Date().toISOString();
let verification: any;
try { const observed = await launch('live'); verification = { number: 109, startedAt, finishedAt: new Date().toISOString(), status: observed.verified ? 'passed' : 'failed', observed }; }
catch (error) { const message = error instanceof Error ? error.message : String(error); verification = { number: 109, startedAt, finishedAt: new Date().toISOString(), status: /credit|balance|auth|login|logged in|API.key|401|403/i.test(message) ? 'unavailable' : 'failed', error: message }; }
await writeFile('verification-live.json', JSON.stringify(verification, null, 2));
console.log(JSON.stringify({ number: 109, status: verification.status, error: verification.error, checks: verification.observed?.checks }));
if (verification.status !== 'passed') process.exitCode = 1;
