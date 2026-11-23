import path from 'node:path';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { query, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { chooseRoute, readAnswer } from './routes.js';

const root = path.resolve(import.meta.dirname, '..');
const fixture = path.join(root, 'fixtures/project.txt');
const require = createRequire(import.meta.url);
const execute = promisify(execFile);
const system =
  'Read the supplied project facts and summarize its name, purpose, audience, language and verification marker in at most fifty words. Preserve the marker exactly.';
const agentPrompt =
  'First use Read to read ' +
  fixture +
  '. Then summarize those project facts, including COMPASS-001.';
function toolsFrom(message: SDKMessage) {
  return message.type === 'assistant' && Array.isArray(message.message?.content)
    ? message.message.content
        .filter((block) => block.type === 'tool_use')
        .map((block) => ({ name: block.name, input: block.input }))
    : [];
}
export async function runComparison(value: unknown, parser: unknown = 'correct') {
  const route = chooseRoute(value);
  if (parser !== 'correct' && parser !== 'wrong-client')
    throw new Error(
      'INVALID_PARSER · Select the correct response contract or the classroom parser bug.',
    );
  if (parser === 'wrong-client' && route.id !== 'embedded')
    throw new Error(
      'INVALID_PARSER · The classroom parser bug applies to the embedded agent example.',
    );
  if (route.id === 'managed')
    return {
      route,
      parser,
      comparisonOnly: true,
      nativeResponse: null,
      toolCalls: [],
      answer:
        'Agent, environment, session and event APIs configure the hosted harness. Review this route when the application should use Anthropic-operated agent execution.',
      error: '',
      verified: true,
      checkedAt: new Date().toISOString(),
    };
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
  let nativeResponse: unknown = null;
  let nativeVersion = '';
  const toolCalls: Array<{ name: string; input: unknown }> = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let answer = '';
  let error = '';
  try {
    if (route.id === 'embedded') {
      run = query({
        prompt: agentPrompt,
        options: {
          cwd: root,
          model,
          tools: ['Read'],
          allowedTools: ['Read'],
          mcpServers: {},
          settingSources: [],
          maxTurns: 4,
          maxBudgetUsd: 0.5,
          abortController: controller,
          systemPrompt: system,
        },
      });
      for await (const message of run) {
        toolCalls.push(...toolsFrom(message));
        if (message.type === 'system' && message.subtype === 'init')
          nativeVersion = message.claude_code_version;
        if (message.type === 'result') nativeResponse = message;
      }
    } else if (route.id === 'terminal') {
      const sdkDirectory = path.dirname(require.resolve('@anthropic-ai/claude-agent-sdk'));
      const nativeDirectory = path.resolve(
        sdkDirectory,
        '..',
        'claude-agent-sdk-' + process.platform + '-' + process.arch,
      );
      const executable = path.join(
        nativeDirectory,
        process.platform === 'win32' ? 'claude.exe' : 'claude',
      );
      const args = [
        '-p',
        agentPrompt,
        '--output-format',
        'stream-json',
        '--verbose',
        '--tools',
        'Read',
        '--allowedTools',
        'Read',
        '--model',
        model,
        '--max-turns',
        '4',
        '--max-budget-usd',
        '0.5',
        '--setting-sources',
        '',
        '--strict-mcp-config',
        '--mcp-config',
        '{"mcpServers":{}}',
        '--no-session-persistence',
        '--system-prompt',
        system,
      ];
      const result = await execute(executable, args, {
        cwd: root,
        windowsHide: true,
        timeout: 90000,
        maxBuffer: 2 * 1024 * 1024,
        signal: controller.signal,
      });
      for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
        const message = JSON.parse(line) as SDKMessage;
        toolCalls.push(...toolsFrom(message));
        if (message.type === 'system' && message.subtype === 'init')
          nativeVersion = message.claude_code_version;
        if (message.type === 'result') nativeResponse = message;
      }
    } else {
      const facts = await readFile(fixture, 'utf8');
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        timeout: 90000,
        maxRetries: 1,
      });
      nativeResponse = await client.messages.create(
        { model, max_tokens: 200, system, messages: [{ role: 'user', content: facts }] },
        { signal: controller.signal },
      );
    }
    const contract =
      parser === 'wrong-client' || route.id === 'api' ? 'client-message' : 'agent-result';
    answer = readAnswer(nativeResponse, contract);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const nativeAnswer =
    nativeResponse && typeof nativeResponse === 'object' && 'result' in nativeResponse
      ? String(nativeResponse.result)
      : answer;
  const factsVerified = ['Course Compass', 'COMPASS-001', 'TypeScript'].every((fact) =>
    nativeAnswer.includes(fact),
  );
  const readObserved = route.id === 'api' || toolCalls.some((tool) => tool.name === 'Read');
  const verified =
    parser === 'wrong-client'
      ? error.startsWith('RESPONSE_SHAPE_MISMATCH') && factsVerified && readObserved
      : !error && factsVerified && readObserved;
  return {
    route,
    parser,
    comparisonOnly: false,
    nativeResponse,
    nativeVersion,
    toolCalls,
    applicationProvidedFileContent: route.id === 'api',
    answer,
    error,
    factsVerified,
    readObserved,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
