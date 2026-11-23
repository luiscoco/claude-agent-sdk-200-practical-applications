import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { query, type Query } from '@anthropic-ai/claude-agent-sdk';
import { MessageQueue } from './queue.js';
import { backgroundCommand, commandCapture, approvedBackground } from './command.js';

export class BackgroundSession {
  readonly id = randomUUID();
  readonly done: Promise<void>;
  readonly command: string;
  private readonly input = new MessageQueue();
  private readonly run: Query;
  private readonly timer: ReturnType<typeof setTimeout>;
  private stage = 'starting';
  private closed = false;
  private settled = false;
  private sessionId = '';
  private taskId = '';
  private error = '';
  private stopRequested = false;
  private stopAcknowledged = false;
  private stopPending?: Promise<void>;
  private nativeResponse: unknown = null;
  private terminalEvent: { status: string; task_id: string; summary: string } | null = null;
  private readonly events: Array<{
    sequence: number;
    observedAt: string;
    type: string;
    detail: unknown;
  }> = [];

  static async create(mode: unknown) {
    if (mode !== 'complete' && mode !== 'cancel')
      throw new Error('INVALID_MODE · Select completion or cancellation.');
    if (!process.env.ANTHROPIC_API_KEY?.trim())
      throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
    const root = path.resolve(import.meta.dirname, '..');
    await mkdir(path.join(root, 'runs'), { recursive: true });
    const workspace = await mkdtemp(path.join(root, 'runs/background-'));
    return new BackgroundSession(root, workspace, mode, randomUUID());
  }

  private constructor(
    root: string,
    readonly workspace: string,
    readonly mode: 'complete' | 'cancel',
    private readonly nonce: string,
  ) {
    this.command = backgroundCommand(root, workspace, mode, nonce);
    this.input.push({
      type: 'user',
      uuid: randomUUID(),
      parent_tool_use_id: null,
      message: {
        role: 'user',
        content: `Use native Bash to start this exact command once with run_in_background true and timeout 60000. Briefly report its background task ID, then wait for its task notification.\n${this.command}`,
      },
    });
    this.run = query({
      prompt: this.input.messages(),
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Bash'],
        settingSources: [],
        mcpServers: {},
        maxTurns: 4,
        maxBudgetUsd: 0.75,
        systemPrompt:
          'Start the supplied bounded classroom background command exactly once. Report the observed task ID briefly. The host handles cancellation through the SDK control method. After completion or cancellation, describe the actual notification briefly.',
        canUseTool: async (name, input) =>
          approvedBackground(name, input, this.command)
            ? { behavior: 'allow', updatedInput: input }
            : {
                behavior: 'deny',
                message: 'Only the exact approved background command and timeout are allowed.',
              },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                async (input) =>
                  input.hook_event_name === 'PreToolUse'
                    ? {
                        hookSpecificOutput: {
                          hookEventName: 'PreToolUse',
                          permissionDecision: approvedBackground(
                            input.tool_name,
                            input.tool_input as Record<string, unknown>,
                            this.command,
                          )
                            ? 'allow'
                            : 'deny',
                        },
                      }
                    : {},
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUse') {
                    this.nativeResponse = input.tool_response;
                    const response = input.tool_response as { backgroundTaskId?: string };
                    if (response.backgroundTaskId) {
                      this.taskId = response.backgroundTaskId;
                      this.stage = 'running';
                    }
                    this.observe('native-Bash-response', input.tool_response);
                  }
                  return {};
                },
              ],
            },
          ],
          PostToolUseFailure: [
            {
              matcher: 'Bash',
              hooks: [
                async (input) => {
                  if (input.hook_event_name === 'PostToolUseFailure')
                    this.observe('native-Bash-failure', input.error);
                  return {};
                },
              ],
            },
          ],
        },
      },
    });
    this.timer = setTimeout(() => {
      this.error = 'SESSION_TIMEOUT · The classroom experiment exceeded 90 seconds.';
      this.close();
    }, 90000);
    this.done = this.consume();
  }

  private observe(type: string, detail: unknown) {
    this.events.push({
      sequence: this.events.length + 1,
      observedAt: new Date().toISOString(),
      type,
      detail,
    });
  }

  async cancel() {
    if (this.stopPending) return this.stopPending;
    if (this.stage !== 'running' || !this.taskId || this.closed)
      throw new Error(
        'TASK_NOT_RUNNING · Wait for the actual background task ID before cancelling.',
      );
    this.stopRequested = true;
    this.stage = 'cancelling';
    this.observe('stopTask-request', { taskId: this.taskId });
    this.stopPending = (async () => {
      try {
        await this.run.stopTask(this.taskId);
        this.stopAcknowledged = true;
        this.observe('stopTask-acknowledged', { taskId: this.taskId });
        if (this.terminalEvent) this.close();
      } catch (error) {
        this.observe('stopTask-error', error instanceof Error ? error.message : String(error));
        if (!this.terminalEvent) {
          this.error = String(error);
          this.stage = 'failed';
          this.close();
        }
        throw error;
      }
    })();
    return this.stopPending;
  }

  private async consume() {
    try {
      for await (const message of this.run) {
        if (message.type === 'system' && message.subtype === 'init')
          this.sessionId = message.session_id;
        if (
          message.type === 'system' &&
          [
            'task_started',
            'task_updated',
            'task_notification',
            'background_tasks_changed',
          ].includes(message.subtype)
        )
          this.observe(message.subtype, message);
        if (message.type === 'assistant')
          for (const block of message.message.content)
            if (block.type === 'tool_use' || block.type === 'text')
              this.observe('assistant-' + block.type, block);
        if (message.type === 'user') this.observe('native-tool-result', message.message.content);
        if (message.type === 'result') this.observe('conversation-result', message);
        if (
          message.type === 'system' &&
          message.subtype === 'task_notification' &&
          message.task_id === this.taskId
        ) {
          this.terminalEvent = message;
          this.stage = message.status;
          this.input.end();
          if (!this.stopRequested || this.stopAcknowledged) this.close();
        }
      }
      if (!this.terminalEvent && !this.closed) {
        this.stage = 'failed';
        this.error = 'TASK_NOTIFICATION_MISSING · Inspect the preserved native events.';
      }
    } catch (error) {
      if (!this.closed) {
        this.error = error instanceof Error ? error.message : String(error);
        this.stage = 'failed';
      }
    } finally {
      this.close();
      const deadline = Date.now() + 25000;
      let captured = await commandCapture(this.workspace, this.nonce);
      while (captured.processAlive === true && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        captured = await commandCapture(this.workspace, this.nonce);
      }
      this.settled = true;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.input.end();
    this.run.close();
    if (!['completed', 'stopped', 'failed'].includes(this.stage))
      this.stage = this.error ? 'failed' : 'closed';
  }

  async snapshot() {
    const wasClosed = this.closed;
    let captured = await commandCapture(this.workspace, this.nonce);
    if (!wasClosed && this.closed) captured = await commandCapture(this.workspace, this.nonce);
    const completed =
      this.terminalEvent?.status === 'completed' &&
      captured.exitCode === 0 &&
      captured.stdout?.includes('BACKGROUND_COMPLETED');
    const cancelled =
      this.terminalEvent?.status === 'stopped' &&
      this.stopRequested &&
      this.stopAcknowledged &&
      !captured.stdout?.includes('BACKGROUND_COMPLETED');
    const verified =
      !this.error &&
      this.closed &&
      this.settled &&
      Boolean(this.taskId) &&
      captured.receiptMatches &&
      captured.processAlive === false &&
      Boolean(completed || cancelled);
    return {
      id: this.id,
      mode: this.mode,
      stage: this.stage,
      closed: this.closed && this.settled,
      workspace: this.workspace,
      command: this.command,
      sessionId: this.sessionId,
      taskId: this.taskId,
      nativeResponse: structuredClone(this.nativeResponse),
      terminalEvent: structuredClone(this.terminalEvent),
      stopRequested: this.stopRequested,
      stopAcknowledged: this.stopAcknowledged,
      events: structuredClone(this.events),
      captured,
      verified,
      error: this.error,
      checkedAt: new Date().toISOString(),
    };
  }
}
