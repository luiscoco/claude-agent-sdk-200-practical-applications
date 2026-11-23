import {randomUUID} from 'node:crypto';
import {query,type Query,type SDKResultMessage} from '@anthropic-ai/claude-agent-sdk';
import {MessageQueue} from './queue.js';

export const examples = {
  store:'Remember our course codename ORBIT and its starting lesson budget of 120. Reply with exactly STORED',
  recall:'What is our course codename? Reply with only the codename.',
  update:'Add 30 to our starting lesson budget. Reply with only the new integer budget.'
};
export type ConversationTurn = {
  id:string; prompt:string; answer:string; sessionId:string;
  resultMessageId:string|null; correlationMatched:boolean; resultSubtype:string; isError:boolean;
};
type PendingTurn = {id:string;prompt:string;resolve:(turn:ConversationTurn) => void;reject:(error:Error) => void;timer:NodeJS.Timeout};

export function validateMessage(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000) throw new Error('INVALID_MESSAGE · Enter between 1 and 2000 characters.');
  return value.trim();
}

export class Conversation {
  readonly id = randomUUID();
  readonly done: Promise<void>;
  private readonly input = new MessageQueue();
  private readonly run: Query;
  private pending?: PendingTurn;
  private sessionId = '';
  private model = '';
  private closed = false;
  private closeReason = '';
  private readonly turns: ConversationTurn[] = [];

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
    this.run = query({prompt:this.input.messages(),options:{
      model:process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools:[],mcpServers:{},settingSources:[],maxTurns:4,maxBudgetUsd:1,
      systemPrompt:'You are a concise course-planning tutor. Use the facts supplied in this conversation and follow the requested response format.'
    }});
    this.done = this.consume();
  }

  async send(value: unknown) {
    if (this.closed) throw new Error('SESSION_CLOSED · Start a new conversation before sending a message.');
    if (this.pending) throw new Error('TURN_BUSY · Wait for the current answer before sending another message.');
    const id = randomUUID();
    const prompt = validateMessage(value);
    return new Promise<ConversationTurn>((resolve,reject) => {
      const timer = setTimeout(() => this.close('TURN_TIMEOUT · The message exceeded 120 seconds.'),120000);
      this.pending = {id,prompt,resolve,reject,timer};
      this.input.push({type:'user',uuid:id,origin:{kind:'human'},message:{role:'user',content:prompt},parent_tool_use_id:null});
    });
  }

  private finishTurn(message: SDKResultMessage) {
    const pending = this.pending;
    if (!pending) return;
    if (this.sessionId && message.session_id !== this.sessionId) throw new Error('SESSION_MISMATCH · The native session changed unexpectedly.');
    this.sessionId = message.session_id;
    const answer = message.subtype === 'success' ? message.result : message.errors.join(' ');
    const turn: ConversationTurn = {id:pending.id,prompt:pending.prompt,answer,sessionId:message.session_id,
      resultMessageId:message.user_message_uuid ?? null,
      correlationMatched:message.user_message_uuid === pending.id || message.user_message_uuids?.includes(pending.id) === true,
      resultSubtype:message.subtype,isError:message.is_error};
    clearTimeout(pending.timer);
    this.pending = undefined;
    this.turns.push(turn);
    pending.resolve(turn);
  }

  private async consume() {
    try {
      for await (const message of this.run) {
        if (message.type === 'system' && message.subtype === 'init') {
          this.sessionId = message.session_id;this.model = message.model;
        }
        if (message.type === 'result') this.finishTurn(message);
      }
    } catch (error) {
      if (!this.closed) this.closeReason = error instanceof Error ? error.message : String(error);
    } finally {this.close(this.closeReason || 'The SDK stream ended.');}
  }

  close(reason = 'Closed by the student.') {
    if (this.closed) return;
    this.closed = true;
    this.closeReason = reason;
    this.input.end();
    if (this.pending) {
      clearTimeout(this.pending.timer);this.pending.reject(new Error(reason));this.pending = undefined;
    }
    this.run.close();
  }
  snapshot() {
    return {id:this.id,sessionId:this.sessionId,model:this.model,closed:this.closed,closeReason:this.closeReason,
      busy:Boolean(this.pending),turns:this.turns.map(turn => ({...turn})),
      verified:this.turns.length > 0 && this.turns.every(turn => turn.correlationMatched && turn.sessionId === this.sessionId
        && turn.resultSubtype === 'success' && !turn.isError)};
  }
}
