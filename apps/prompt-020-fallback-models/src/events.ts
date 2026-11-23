export type FallbackNotice = {
  type:'system'; subtype:'model_fallback'; trigger:string;
  original_model:string; fallback_model:string; content:string;
};

// Native CLI 2.1.322 emits this event before the SDK 0.3.322 union declares it.
export function readFallbackNotice(message: unknown): FallbackNotice | null {
  if (!message || typeof message !== 'object') return null;
  const event = message as Record<string,unknown>;
  if (event.type !== 'system' || event.subtype !== 'model_fallback') return null;
  if (['trigger','original_model','fallback_model','content'].some(key => typeof event[key] !== 'string')) return null;
  return {type:'system',subtype:'model_fallback',trigger:event.trigger as string,
    original_model:event.original_model as string,fallback_model:event.fallback_model as string,content:event.content as string};
}
