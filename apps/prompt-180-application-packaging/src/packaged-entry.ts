import { query } from '@anthropic-ai/claude-agent-sdk/core';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const packageName = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
const executable = require.resolve(packageName + '/' + (process.platform === 'win32' ? 'claude.exe' : 'claude'));
const live = process.argv[2] === 'live';
async function* input(): AsyncGenerator<any> { yield { type: 'user', uuid: randomUUID(), message: { role: 'user', content: 'Reply with one packaging safeguard.' }, parent_tool_use_id: null, shouldQuery: live }; }
const runtime = query({ prompt: input(), options: { pathToClaudeCodeExecutable: executable, cwd: process.env.LAB_WORKSPACE, tools: [], settingSources: [], strictMcpConfig: true, maxTurns: 2, maxBudgetUsd: 0.35 } });
const events: any[] = []; try { for await (const event of runtime) events.push(event); } finally { runtime.close(); }
const result = events.findLast(event => event.type === 'result');
console.log(JSON.stringify({ success: result?.subtype === 'success', turns: result?.num_turns, version: events.find(event => event.type === 'system' && event.subtype === 'init')?.claude_code_version, events }));
