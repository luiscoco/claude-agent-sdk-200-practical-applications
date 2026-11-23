import 'dotenv/config';
import { inspectStates, inspectConnectionTimeout } from './states.js';
import { inspectToolCall } from './agent.js';
const mode = process.argv[2] || 'states';
let report;
if (mode === 'states' || mode === 'states-repaired')
  report = await inspectStates(mode === 'states-repaired');
else if (mode === 'connection-timeout') report = await inspectConnectionTimeout();
else if (mode === 'tool-timeout' || mode === 'success')
  report = await inspectToolCall(
    { message: process.argv[3] || 'Connection budgets are separate' },
    mode === 'success',
  );
else throw new Error('Use states, states-repaired, connection-timeout, tool-timeout or success.');
console.log(JSON.stringify(report, null, 2));
if (!report.verified) process.exitCode = 1;
