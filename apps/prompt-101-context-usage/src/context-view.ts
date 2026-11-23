import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['baseline', 'short', 'long', 'compare']),
    topic: z.enum(['MCP', 'Hooks']),
  })
  .strict();
export const usageSchema = z
  .object({
    model: z.string(),
    total_tokens: z.number().int().min(0),
    raw_max_tokens: z.number().int().positive(),
    percentage: z.number().min(0),
    categories: z.array(
      z
        .object({
          name: z.string(),
          tokens: z.number().int().min(0),
          kind: z.enum(['used', 'buffer', 'free']),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export function contextView(value: unknown) {
  const usage = usageSchema.parse(value);
  const used = usage.categories
    .filter((category) => category.kind === 'used')
    .sort((a, b) => b.tokens - a.tokens);
  return {
    model: usage.model,
    usedTokens: usage.total_tokens,
    windowTokens: usage.raw_max_tokens,
    reservedTokens: usage.categories
      .filter((category) => category.kind === 'buffer')
      .reduce((sum, category) => sum + category.tokens, 0),
    freeTokens: usage.categories
      .filter((category) => category.kind === 'free')
      .reduce((sum, category) => sum + category.tokens, 0),
    largestUsedContributor: used[0] ?? null,
    rankedUsedContributors: used,
    segments: usage.categories.map((category) => ({
      ...category,
      percentageOfReportedWindow: (category.tokens / usage.raw_max_tokens) * 100,
    })),
  };
}
