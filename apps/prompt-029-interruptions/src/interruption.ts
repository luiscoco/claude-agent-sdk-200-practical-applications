import { randomUUID } from 'node:crypto';
import {
  query,
  type Query,
  type SDKResultMessage,
  type SDKControlInterruptResponse,
} from '@anthropic-ai/claude-agent-sdk';
import { MessageQueue } from './queue.js';

export const classroomCommand = "sleep 20; printf 'WAIT_FINISHED\\n'";
export type Stage =
  | 'starting'
  | 'tool-requested'
  | 'interrupting'
  | 'interrupted'
  | 'continuing'
  | 'completed'
  | 'failed'
  | 'closed';
type Observation = {
  sequence: number;
  phase: string;
  type: string;
  subtype?: string;
  detail: unknown;
};

export function validateFollowup(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 300)
    throw new Error('INVALID_FOLLOWUP · Enter between 1 and 300 characters.');
  return value.trim();
}

export class InterruptionSession {
  readonly id = randomUUID();
  readonly done: Promise<void>;
  private readonly input = new MessageQueue();
  private readonly run: Query;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly firstId = randomUUID();
  private followupId: ReturnType<typeof randomUUID> | '' = '';
  private stage: Stage = 'starting';
  private sessionId = '';
  private error = '';
  private closed = false;
  private receipt: SDKControlInterruptResponse | null = null;
  private receiptReceived = false;
  private readonly observations: Observation[] = [];
  private readonly results: SDKResultMessage[] = [];
  private toolRequestedAt = 0;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY?.trim())
      throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
    this.input.push({
      type: 'user',
      uuid: this.firstId,
      origin: { kind: 'human' },
      message: {
        role: 'user',
        content:
          'Run exactly this foreground Bash command once: ' +
          classroomCommand +
          '. Wait for its result before answering.',
      },
      parent_tool_use_id: null,
    });
    this.run = query({
      prompt: this.input.messages(),
      options: {
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: ['Bash'],
        mcpServers: {},
        settingSources: [],
        maxTurns: 4,
        maxBudgetUsd: 1,
        systemPrompt:
          'Follow the current user instruction precisely. Use Bash for the requested waiting command. For a later text-only instruction, answer directly without tools.',
        canUseTool: async (name, input) =>
          name === 'Bash' && input.command === classroomCommand
            ? {
                behavior: 'allow',
                updatedInput: { ...input, run_in_background: false, timeout: 30000 },
              }
            : { behavior: 'deny', message: 'Use only the exact classroom waiting command.' },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                async (input) => {
                  if (input.hook_event_name !== 'PreToolUse') return {};
                  const requested = input.tool_input as Record<string, unknown>;
                  if (requested.command !== classroomCommand)
                    return {
                      hookSpecificOutput: {
                        hookEventName: 'PreToolUse',
                        permissionDecision: 'deny',
                        permissionDecisionReason: 'Use the exact classroom command.',
                      },
                    };
                  this.toolRequestedAt = Date.now();
                  this.stage = 'tool-requested';
                  this.observe('tool-request', {
                    tool: input.tool_name,
                    command: requested.command,
                  });
                  return {
                    hookSpecificOutput: {
                      hookEventName: 'PreToolUse',
                      permissionDecision: 'allow',
                      updatedInput: { ...requested, run_in_background: false, timeout: 30000 },
                    },
                  };
                },
              ],
            },
          ],
        },
      },
    });
    this.timer = setTimeout(() => {
      this.error = 'SESSION_TIMEOUT · The classroom session exceeded 120 seconds.';
      this.close();
    }, 120000);
    this.done = this.consume();
  }

  private observe(type: string, detail: unknown, subtype?: string) {
    this.observations.push({
      sequence: this.observations.length + 1,
      phase: this.followupId ? 'followup' : 'first-turn',
      type,
      subtype,
      detail,
    });
  }

  async interrupt() {
    if (this.stage !== 'tool-requested')
      throw new Error('TURN_NOT_ACTIVE · Wait for the classroom tool request before interrupting.');
    this.stage = 'interrupting';
    this.observe('interrupt-request', {
      elapsedSinceToolRequestMs: Date.now() - this.toolRequestedAt,
    });
    try {
      this.receipt = (await this.run.interrupt()) ?? null;
      this.receiptReceived = true;
      this.observe('interrupt-receipt', this.receipt);
      return this.snapshot();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.stage = 'failed';
      this.close();
      throw error;
    }
  }

  continue(value: unknown) {
    if (this.closed) throw new Error('SESSION_CLOSED · Start a new interruption experiment.');
    if (this.stage !== 'interrupted')
      throw new Error('DRAIN_REQUIRED · Wait for the interrupted turn result before continuing.');
    const prompt = validateFollowup(value);
    this.followupId = randomUUID();
    this.stage = 'continuing';
    this.observe('followup-submitted', { uuid: this.followupId, prompt });
    this.input.push({
      type: 'user',
      uuid: this.followupId,
      origin: { kind: 'human' },
      message: { role: 'user', content: prompt },
      parent_tool_use_id: null,
    });
    return this.snapshot();
  }

  private async consume() {
    try {
      for await (const message of this.run) {
        if (message.type === 'system' && message.subtype === 'init')
          this.sessionId = message.session_id;
        if (message.type === 'assistant') {
          const content = message.message.content.filter(
            (block) => block.type === 'text' || block.type === 'tool_use',
          );
          if (content.length) this.observe('assistant', content);
        }
        if (message.type === 'user') this.observe('user', message.message.content);
        if (message.type !== 'result') continue;
        this.results.push(message);
        this.observe(
          'result',
          {
            sessionId: message.session_id,
            uuid: message.user_message_uuid,
            uuids: message.user_message_uuids,
            isError: message.is_error,
            terminalReason: message.terminal_reason,
            answer: message.subtype === 'success' ? message.result : message.errors,
          },
          message.subtype,
        );
        if (this.results.length === 1) {
          this.stage = ['aborted_tools', 'aborted_streaming'].includes(
            message.terminal_reason || '',
          )
            ? 'interrupted'
            : 'failed';
          if (this.stage === 'failed') {
            this.error = 'INTERRUPTION_NOT_OBSERVED · Inspect the first native result.';
            this.close();
          }
        } else {
          this.stage = message.subtype === 'success' && !message.is_error ? 'completed' : 'failed';
          this.input.end();
        }
      }
    } catch (error) {
      if (!this.closed) {
        this.error = error instanceof Error ? error.message : String(error);
        this.stage = 'failed';
      }
    } finally {
      this.close();
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.input.end();
    this.run.close();
    if (!['completed', 'failed'].includes(this.stage))
      this.stage = this.error ? 'failed' : 'closed';
  }

  snapshot() {
    const first = this.results[0];
    const last = this.results[1];
    return {
      id: this.id,
      stage: this.stage,
      sessionId: this.sessionId,
      closed: this.closed,
      error: this.error,
      firstId: this.firstId,
      followupId: this.followupId,
      receiptReceived: this.receiptReceived,
      receipt: this.receipt,
      observations: structuredClone(this.observations),
      results: structuredClone(this.results),
      verified:
        this.stage === 'completed' &&
        this.receiptReceived &&
        Boolean(
          first &&
          ['aborted_tools', 'aborted_streaming'].includes(first.terminal_reason || '') &&
          last &&
          last.session_id === first.session_id &&
          last.subtype === 'success' &&
          !last.is_error &&
          (last.user_message_uuid === this.followupId ||
            last.user_message_uuids?.includes(this.followupId)),
        ),
    };
  }
}
