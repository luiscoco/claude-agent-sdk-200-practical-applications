export type RenderMode = 'reconciled' | 'naive' | 'completed-only';
type TextBlock = {
  key: string;
  messageId: string;
  streamed: string;
  completed: string | null;
  displayed: string;
};

export class TextRenderer {
  private readonly blocks = new Map<string, TextBlock>();
  private readonly completedEvents = new Set<string>();
  constructor(private readonly mode: RenderMode) {}

  start(messageId: string, index: number, initialText = '') {
    const key = messageId + ':' + index;
    if (!this.blocks.has(key))
      this.blocks.set(key, {
        key,
        messageId,
        streamed: initialText,
        completed: null,
        displayed: this.mode === 'completed-only' ? '' : initialText,
      });
  }

  delta(messageId: string, index: number, text: string) {
    this.start(messageId, index);
    const block = this.blocks.get(messageId + ':' + index)!;
    block.streamed += text;
    if (this.mode !== 'completed-only') block.displayed += text;
  }

  complete(messageId: string, eventId: string, text: string) {
    if (this.completedEvents.has(eventId)) return;
    this.completedEvents.add(eventId);
    let block = [...this.blocks.values()].find(
      (item) => item.messageId === messageId && item.completed === null,
    );
    if (!block) {
      const key = messageId + ':complete:' + eventId;
      block = { key, messageId, streamed: '', completed: null, displayed: '' };
      this.blocks.set(key, block);
    }
    block.completed = text;
    // Completed text replaces the same block's incremental display.
    block.displayed = this.mode === 'naive' ? block.displayed + text : text;
  }

  snapshot() {
    const blocks = [...this.blocks.values()].map((block) => ({ ...block }));
    return {
      blocks,
      visibleText: blocks.map((block) => block.displayed).join(''),
      completedText: blocks.map((block) => block.completed ?? '').join(''),
    };
  }
}

export function validateMode(value: unknown): RenderMode {
  if (value !== 'reconciled' && value !== 'naive' && value !== 'completed-only')
    throw new Error('INVALID_MODE · Select reconciled, naive, or completed-only.');
  return value;
}
