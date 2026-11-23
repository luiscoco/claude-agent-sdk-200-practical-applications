import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { expectedContent, inspectReport, sha256 } from './report.js';
export async function writeReport(value: unknown) {
  if (value !== 'create' && value !== 'blocked')
    throw new Error('INVALID_MODE · Select report creation or the classroom Write denial.');
  const mode = value;
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const runs = path.resolve(import.meta.dirname, '../runs');
  await mkdir(runs, { recursive: true });
  const workspace = await mkdtemp(path.join(runs, 'write-'));
  const target = path.join(workspace, 'report.md');
  const before = await inspectReport(target);
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const toolResults: Array<{
    toolUseId: string;
    name: string;
    isError: boolean;
    content: unknown;
  }> = [];
  const decisions: Array<{ tool: string; toolUseId: string; allowed: boolean; reason: string }> =
    [];
  const permitted = (name: string, input: Record<string, unknown>) => {
    if (typeof input.file_path !== 'string') return false;
    const requested = path.resolve(workspace, input.file_path);
    const samePath =
      process.platform === 'win32'
        ? requested.toLowerCase() === target.toLowerCase()
        : requested === target;
    return (
      samePath &&
      (name === 'Read' ||
        (name === 'Write' &&
          typeof input.content === 'string' &&
          input.content.length <= 10000 &&
          mode === 'create'))
    );
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let run: Query | undefined;
  let success = false;
  let answer = '';
  let error = '';
  let sessionId = '';
  let permissionDenials: unknown[] = [];
  try {
    run = query({
      prompt:
        'Use Write once to create ' +
        JSON.stringify(target) +
        ' with this exact content string: ' +
        JSON.stringify(expectedContent) +
        '. After a successful Write, use Read on that same file to inspect its contents, then reply REPORT_WRITTEN. If Write is denied, stop and report REPORT_BLOCKED without attempting another path or tool.',
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Write', 'Read'],
        mcpServers: {},
        settingSources: [],
        maxTurns: 6,
        maxBudgetUsd: 0.75,
        abortController: controller,
        systemPrompt:
          'Create the requested report with the native Write tool and verify it with the native Read tool. Preserve the exact supplied file path and Markdown content.',
        canUseTool: async (name, input) =>
          permitted(name, input)
            ? { behavior: 'allow', updatedInput: input }
            : {
                behavior: 'deny',
                message: 'The classroom policy permits only the requested report path.',
              },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Write|Read',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const allowed = permitted(
                    input.tool_name,
                    input.tool_input as Record<string, unknown>,
                  );
                  const reason =
                    mode === 'blocked' && input.tool_name === 'Write'
                      ? 'Classroom scenario denies the native Write operation.'
                      : 'Use only the requested classroom report path.';
                  decisions.push({
                    tool: input.tool_name,
                    toolUseId: input.tool_use_id,
                    allowed,
                    reason,
                  });
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: allowed ? 'allow' : 'deny',
                      permissionDecisionReason: reason,
                    },
                  };
                },
              ],
            },
          ],
        },
      },
    });
    for await (const message of run) {
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use')
            calls.push({ id: block.id, name: block.name, input: block.input });
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = calls.find((call) => call.id === block.tool_use_id);
          if (call)
            toolResults.push({
              toolUseId: block.tool_use_id,
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
            });
        }
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
        sessionId = message.session_id;
        permissionDenials = message.permission_denials;
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run?.close();
  }
  const after = await inspectReport(target);
  const contentMatched = after.content === expectedContent;
  const writeIndex = calls.findIndex((call) => call.name === 'Write');
  const readIndex = calls.findIndex((call) => call.name === 'Read');
  const writeDenied = decisions.some((decision) => decision.tool === 'Write' && !decision.allowed);
  const verified =
    mode === 'blocked'
      ? writeIndex >= 0 && writeDenied && before.exists === false && after.exists === false
      : success &&
        !error &&
        before.exists === false &&
        after.exists === true &&
        contentMatched &&
        writeIndex >= 0 &&
        readIndex > writeIndex &&
        toolResults.some((result) => result.name === 'Write' && !result.isError) &&
        toolResults.some((result) => result.name === 'Read' && !result.isError);
  return {
    mode,
    workspace,
    target,
    expectedContent,
    expectedSha256: sha256(expectedContent),
    before,
    after,
    calls,
    toolResults,
    decisions,
    permissionDenials,
    contentMatched,
    writeDenied,
    success,
    answer,
    error,
    sessionId,
    verified,
    checkedAt: new Date().toISOString(),
  };
}
