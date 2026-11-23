import path from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

export async function appendTypeScript(persist: boolean, topic: string) {
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/typescript-'));
  const sessionId = randomUUID(),
    promptId = randomUUID(),
    marker = `OWNED_PERSISTENCE_${topic}_${randomUUID()}`;
  await writeFile(
    path.join(workspace, 'owned-note.txt'),
    'Separate host-created classroom file. Native transcript persistence does not control this file.',
  );
  async function* prompts(): AsyncGenerator<SDKUserMessage> {
    yield {
      type: 'user',
      uuid: promptId,
      message: { role: 'user', content: marker },
      parent_tool_use_id: null,
      shouldQuery: false,
    };
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
  };
  delete env.CLAUDE_CODE_SKIP_PROMPT_HISTORY;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 45000);
  const events: Array<Record<string, any>> = [];
  let error = '';
  const run = query({
    prompt: prompts(),
    options: {
      cwd: workspace,
      sessionId,
      model: 'claude-sonnet-4-6',
      tools: [],
      settingSources: [],
      strictMcpConfig: true,
      // Omit the option for the SDK default control; only the disabled profile sets it.
      ...(persist ? {} : { persistSession: false }),
      env,
      abortController: controller,
    },
  });
  try {
    for await (const message of run) events.push(message);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run.close();
  }
  const init = events.find((message) => message.type === 'system' && message.subtype === 'init');
  const result = events.find((message) => message.type === 'result');
  return {
    language: 'TypeScript',
    sdkVersion: '0.3.322',
    nativeVersion: init?.claude_code_version,
    control: persist ? 'SDK default · persistSession omitted' : 'persistSession: false',
    persistenceExpected: persist,
    workspace,
    nativeConfigDirectory: path.join(workspace, 'native-config'),
    requestedSessionId: sessionId,
    promptId,
    marker,
    shouldQuery: false,
    actualSessionId: init?.session_id,
    actualResultSessionId: result?.session_id,
    success: result?.subtype === 'success' && !result?.is_error,
    turns: result?.num_turns,
    costUsd: result?.total_cost_usd,
    durationApiMs: result?.duration_api_ms,
    assistantMessageCount: events.filter((message) => message.type === 'assistant').length,
    firstClassPersistOption: true,
    events,
    error,
  };
}
