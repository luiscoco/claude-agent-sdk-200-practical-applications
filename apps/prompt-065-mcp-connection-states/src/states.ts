import path from 'node:path';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { query, type McpServerStatus } from '@anthropic-ai/claude-agent-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startClassroomBroker } from './broker.js';
import { publicReport } from './privacy.js';

const root = path.resolve(import.meta.dirname, '..');
export async function auditEvents(file: string) {
  const text = await readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  return text.trim()
    ? text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    : [];
}
async function workspaceFor(prefix: string) {
  await mkdir(path.join(root, 'runs'), { recursive: true });
  return mkdtemp(path.join(root, 'runs', prefix + '-'));
}
export async function inspectStates(repaired: boolean) {
  const workspace = await workspaceFor('states');
  const broker = await startClassroomBroker();
  const localAudit = path.join(workspace, 'local-audit.jsonl');
  const configuredAudit = path.join(workspace, 'configured-audit.jsonl');
  const script = path.join(root, 'src/mcp-server.mjs');
  const mcpServers = {
    local: {
      type: 'stdio' as const,
      command: process.execPath,
      args: [script, localAudit, repaired ? '0' : '2200'],
    },
    protected: {
      type: 'http' as const,
      url: broker.url,
      ...(repaired ? { headers: { Authorization: 'Bearer ' + broker.credential } } : {}),
    },
    configured: {
      type: 'stdio' as const,
      command: process.execPath,
      args: repaired
        ? [script, configuredAudit, '0']
        : [path.join(workspace, 'missing-classroom-server.mjs')],
    },
  };
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  async function* input() {
    await gate;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 70000);
  const run = query({
    prompt: input(),
    options: {
      cwd: workspace,
      tools: [],
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      mcpServers,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      maxTurns: 1,
      maxBudgetUsd: 0.1,
      abortController: controller,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
        CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '0',
        MCP_CONNECTION_NONBLOCKING: '1',
        MCP_TIMEOUT: '60000',
      },
    },
  });
  let closing = false,
    readerError = '',
    assistantMessagesObserved = 0;
  const reader = (async () => {
    try {
      for await (const message of run)
        if (message.type === 'assistant') assistantMessagesObserved++;
    } catch (error) {
      if (!closing) readerError = error instanceof Error ? error.message : String(error);
    }
  })();
  const snapshots: Array<{ elapsedMs: number; statuses: McpServerStatus[] }> = [];
  let error = '';
  const started = Date.now();
  try {
    while (Date.now() - started < 60000) {
      const statuses = await run.mcpServerStatus();
      snapshots.push({ elapsedMs: Date.now() - started, statuses });
      const observed = Object.fromEntries(statuses.map((server) => [server.name, server.status]));
      const ready = repaired
        ? ['local', 'protected', 'configured'].every((name) => observed[name] === 'connected')
        : observed.local === 'connected' &&
          observed.protected === 'needs-auth' &&
          observed.configured === 'failed';
      if (ready) break;
      await delay(350);
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    closing = true;
    release();
    run.close();
    await reader;
    await broker.close();
  }
  const localEvents = await auditEvents(localAudit),
    configuredEvents = await auditEvents(configuredAudit);
  const nativeServerStatus = snapshots.at(-1)?.statuses ?? [];
  const byName = Object.fromEntries(
    nativeServerStatus.map((server) => [server.name, server.status]),
  );
  const statesObserved = [
    ...new Set(snapshots.flatMap((snapshot) => snapshot.statuses.map((server) => server.status))),
  ];
  const checks = {
    userPromptsNotSubmitted: true,
    assistantMessagesAbsent: assistantMessagesObserved === 0,
    noToolHandlerInvoked: [...localEvents, ...configuredEvents].every(
      (event) => event.event !== 'tool-started',
    ),
    expectedLatestStates: repaired
      ? ['local', 'protected', 'configured'].every((name) => byName[name] === 'connected')
      : byName.local === 'connected' &&
        byName.protected === 'needs-auth' &&
        byName.configured === 'failed',
    pendingObserved: repaired || statesObserved.includes('pending'),
  };
  return publicReport(
    {
      mode: repaired ? 'states-repaired' : 'states',
      stage: 'native-state-inspection',
      workspace,
      snapshots,
      nativeServerStatus,
      statesObserved,
      userPromptsSent: 0,
      assistantMessagesObserved,
      localEvents,
      configuredEvents,
      httpEvents: broker.events,
      checks,
      error: error || readerError,
      verified: !error && !readerError && Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
      queryClosed: true,
    },
    [broker.credential, process.env.ANTHROPIC_API_KEY],
  );
}

export async function inspectConnectionTimeout() {
  const workspace = await workspaceFor('initialize-timeout');
  const auditFile = path.join(workspace, 'audit.jsonl');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'src/mcp-server.mjs'), auditFile, '4000'],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'classroom-initialize-probe', version: '1.0.0' });
  const timeoutMs = 1000;
  const started = Date.now();
  let error = '';
  let connected = false;
  try {
    await client.connect(transport, { timeout: timeoutMs });
    connected = true;
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  }
  const elapsedMs = Date.now() - started;
  await client.close().catch(() => {});
  await transport.close().catch(() => {});
  const events = await auditEvents(auditFile);
  const checks = {
    initializeTimedOut: !connected && /timed out|timeout/i.test(error),
    noToolHandlerInvoked: events.every((event) => event.event !== 'tool-started'),
  };
  return {
    mode: 'connection-timeout',
    stage: 'mcp-initialize',
    workspace,
    timeoutMs,
    elapsedMs,
    error,
    connected,
    events,
    checks,
    userPromptsSent: 0,
    nativeServerStatus: [],
    verified: Object.values(checks).every(Boolean),
    checkedAt: new Date().toISOString(),
  };
}
