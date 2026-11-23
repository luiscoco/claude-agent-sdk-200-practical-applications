import { z } from 'zod';
import type { SDKControlGetContextUsageResponse } from '@anthropic-ai/claude-agent-sdk';
export const requestSchema = z
  .object({
    mode: z.enum(['low-threshold', 'high-threshold', 'disabled']),
    lessonId: z.number().int().min(1).max(48),
  })
  .strict();
export type Mode = z.infer<typeof requestSchema>['mode'];
export function searchSetting(mode: Mode) {
  if (mode === 'low-threshold') return 'auto:1';
  if (mode === 'high-threshold') return 'auto:100';
  return 'false';
}
export function toolContextMetrics(
  context: Pick<SDKControlGetContextUsageResponse, 'categories' | 'mcpTools'>,
) {
  return {
    usedMcpTokens:
      context.categories.find((category) => category.id === 'mcp_tools' && category.kind === 'used')
        ?.tokens ?? 0,
    deferredMcpTokens:
      context.categories.find(
        (category) => category.id === 'mcp_tools_deferred' && category.kind === 'deferred',
      )?.tokens ?? 0,
    catalogDefinitionCount: context.mcpTools.filter((tool) => tool.serverName === 'catalog').length,
    rawCatalogLoadedFlags: context.mcpTools.filter(
      (tool) => tool.serverName === 'catalog' && tool.isLoaded === true,
    ).length,
    coreAlwaysLoadFlag:
      context.mcpTools.find((tool) => tool.name === 'mcp__core__health')?.isLoaded === true,
  };
}
export const outputSchema = z
  .object({
    ready: z.boolean(),
    lessonId: z.number().int(),
    title: z.string(),
    minutes: z.number().int(),
  })
  .strict();
export function decodedNative(content: unknown) {
  const texts =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((block) => block?.type === 'text').map((block) => String(block.text))
        : [];
  for (const text of texts) {
    try {
      return JSON.parse(text);
    } catch {}
  }
  return null;
}
