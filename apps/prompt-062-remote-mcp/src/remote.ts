import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const endpoints = {
  connected: 'https://code.claude.com/docs/mcp',
  'invalid-route': 'https://code.claude.com/docs/mcp-unavailable-classroom',
} as const;
export const requestSchema = z
  .object({
    mode: z.enum(['connected', 'invalid-route']),
    query: z.string().trim().min(3).max(250),
  })
  .strict();
export const toolName = 'mcp__docs__search_claude_code_docs';
export const outputSchema = z
  .object({
    toolName: z.literal(toolName),
    sourceExcerpt: z.string().min(20).max(300),
    sourceUrl: z.string().url(),
  })
  .strict();
export function matchesSourceExcerpt(
  content: unknown,
  output: z.infer<typeof outputSchema> | null,
) {
  if (!output) return false;
  const words = output.sourceExcerpt.trim().split(/\s+/).length;
  if (words < 6 || words > 25) return false;
  const texts =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((block) => block?.type === 'text').map((block) => String(block.text))
        : [];
  return texts.some((text) =>
    text.split(/(?=^Title: )/m).some((record) => {
      const link = record.match(/^Link:\s*(https:\/\/code\.claude\.com\/[^\s]+)/m)?.[1];
      const bodyIndex = record.indexOf('Content: ');
      return (
        link === output.sourceUrl &&
        bodyIndex >= 0 &&
        record.slice(bodyIndex + 9).includes(output.sourceExcerpt)
      );
    }),
  );
}
export async function inspectRemote(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { signal: controller.signal },
  });
  const client = new Client({ name: 'course-remote-inspector', version: '1.0.0' });
  try {
    await client.connect(transport, { timeout: 20000 });
    const serverInfo = client.getServerVersion();
    const listing = await client.listTools({}, { timeout: 20000 });
    return {
      connected: true as const,
      serverInfo: serverInfo ?? null,
      tools: listing.tools,
      error: '',
    };
  } catch (failure) {
    return {
      connected: false as const,
      serverInfo: null,
      tools: [],
      error: failure instanceof Error ? failure.message : String(failure),
    };
  } finally {
    clearTimeout(timer);
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
  }
}
