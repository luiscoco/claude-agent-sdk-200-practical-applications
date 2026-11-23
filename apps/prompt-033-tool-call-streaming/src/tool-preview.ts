type Preview = {
  key: string;
  messageId: string;
  index: number;
  toolId: string;
  name: string;
  rawInput: string;
  fragments: number;
  initialInput: unknown;
  state: 'receiving' | 'complete' | 'invalid' | 'incomplete';
  arguments: Record<string, unknown> | null;
  parseError: string;
};

export class ToolPreview {
  private readonly blocks = new Map<string, Preview>();
  constructor(private readonly truncate = false) {}

  start(messageId: string, index: number, toolId: string, name: string, input: unknown) {
    const key = messageId + ':' + index;
    this.blocks.set(key, {
      key,
      messageId,
      index,
      toolId,
      name,
      rawInput: '',
      fragments: 0,
      initialInput: input,
      state: 'receiving',
      arguments: null,
      parseError: '',
    });
  }

  append(messageId: string, index: number, fragment: string) {
    const block = this.blocks.get(messageId + ':' + index);
    if (!block || block.state !== 'receiving') return;
    block.rawInput += fragment;
    block.fragments++;
  }

  complete(messageId: string, index: number) {
    const block = this.blocks.get(messageId + ':' + index);
    if (!block || block.state !== 'receiving') return;
    const source = block.fragments ? block.rawInput : JSON.stringify(block.initialInput);
    try {
      const parsed: unknown = JSON.parse(this.truncate ? source.slice(0, -1) : source);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Tool arguments must be a JSON object.');
      block.arguments = parsed as Record<string, unknown>;
      block.state = 'complete';
    } catch (error) {
      block.state = 'invalid';
      block.parseError =
        'JSON_PREVIEW_ERROR · ' + (error instanceof Error ? error.message : String(error));
    }
  }

  markIncomplete(messageId?: string) {
    for (const block of this.blocks.values()) {
      if (block.state === 'receiving' && (!messageId || block.messageId === messageId))
        block.state = 'incomplete';
    }
  }

  snapshot() {
    return structuredClone([...this.blocks.values()]);
  }
}
