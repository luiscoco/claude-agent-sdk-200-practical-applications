import { randomUUID } from 'node:crypto';
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
type Selection =
  | { kind: 'new' }
  | { kind: 'resume'; sessionId: string }
  | { kind: 'fork'; sessionId: string; boundary?: string };
export async function appendContext(
  workspace: string,
  nativeConfigDirectory: string,
  text: string,
  selection: Selection,
) {
  const promptId = randomUUID();
  async function* prompts(): AsyncGenerator<SDKUserMessage> {
    yield {
      type: 'user',
      uuid: promptId,
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      shouldQuery: false,
    };
  }
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONFIG_DIR: nativeConfigDirectory };
  delete env.CLAUDE_CODE_SKIP_PROMPT_HISTORY;
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 45000);
  const events: Array<Record<string, any>> = [];
  let error = '';
  const run = query({
    prompt: prompts(),
    options: {
      cwd: workspace,
      model: 'claude-sonnet-4-6',
      tools: [],
      settingSources: [],
      strictMcpConfig: true,
      persistSession: true,
      ...(selection.kind !== 'new' ? { resume: selection.sessionId } : {}),
      ...(selection.kind === 'fork'
        ? {
            forkSession: true,
            ...(selection.boundary ? { resumeSessionAt: selection.boundary } : {}),
          }
        : {}),
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
  const init = events.find((message) => message.type === 'system' && message.subtype === 'init'),
    result = events.find((message) => message.type === 'result');
  return {
    selection,
    promptId,
    prompt: text,
    actualSessionId: init?.session_id,
    actualResultSessionId: result?.session_id,
    success: result?.subtype === 'success' && !result?.is_error,
    turns: result?.num_turns,
    costUsd: result?.total_cost_usd,
    durationApiMs: result?.duration_api_ms,
    assistantMessageCount: events.filter((message) => message.type === 'assistant').length,
    events,
    error,
  };
}
