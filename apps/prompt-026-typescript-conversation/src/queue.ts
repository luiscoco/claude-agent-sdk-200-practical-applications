import type {SDKUserMessage} from '@anthropic-ai/claude-agent-sdk';

export class MessageQueue {
  private readonly items: SDKUserMessage[] = [];
  private wake?: () => void;
  private ended = false;

  push(message: SDKUserMessage) {
    if (this.ended) throw new Error('INPUT_CLOSED · Start a new conversation.');
    this.items.push(message);
    this.wake?.();
    this.wake = undefined;
  }
  end() {
    this.ended = true;
    this.wake?.();
    this.wake = undefined;
  }
  async *messages(): AsyncGenerator<SDKUserMessage> {
    while (true) {
      const message = this.items.shift();
      if (message) {yield message;continue;}
      if (this.ended) return;
      await new Promise<void>(resolve => {this.wake = resolve;});
    }
  }
}
