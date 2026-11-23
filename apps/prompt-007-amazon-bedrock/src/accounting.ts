export function latestResult(events: any[]) { return events.findLast(e => e.type === 'result'); }
export function uniqueMessageUsage(events: any[]) {
  const messages = new Map<string, any>();
  for (const event of events) if (event.type === 'assistant' && event.message?.id && event.message?.usage)
    messages.set(event.message.id, event.message);
  const totals = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  for (const message of messages.values()) {
    totals.input += message.usage.input_tokens ?? 0; totals.output += message.usage.output_tokens ?? 0;
    totals.cacheRead += message.usage.cache_read_input_tokens ?? 0; totals.cacheCreation += message.usage.cache_creation_input_tokens ?? 0;
  }
  return { uniqueApiMessages: messages.size, totals };
}
export function incrementalCost(previous: number | null, current: number) {
  if (!Number.isFinite(current) || current < 0) throw new Error('Invalid cumulative cost.');
  if (previous !== null && current < previous) return { incrementalUsd: null, resetDetected: true, reason: 'Counter decreased; begin an explicitly identified accounting epoch instead of subtracting across it.' };
  return { incrementalUsd: previous === null ? current : current - previous, resetDetected: false };
}
export function usageView(result: any) {
  return { nativeUsage: result?.usage ?? null, modelUsage: result?.modelUsage ?? null,
    estimatedCumulativeCostUsd: result?.total_cost_usd ?? null, durationApiMs: result?.duration_api_ms ?? null,
    turns: result?.num_turns ?? null, subtype: result?.subtype, terminalReason: result?.terminal_reason };
}
