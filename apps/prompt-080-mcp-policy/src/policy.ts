import { z } from 'zod';

export const nativeToolName = 'mcp__classroom__save_note';
export const requestSchema = z
  .object({
    topic: z.enum(['MCP', 'Hooks']),
    mode: z.enum([
      'preapproved',
      'ask-allow',
      'ask-deny',
      'unattended',
      'policy-deny',
      'bypass-ask',
    ]),
  })
  .strict();
export type Request = z.infer<typeof requestSchema>;
export function policyConfiguration(mode: Request['mode']) {
  const permissionMode =
    mode === 'unattended'
      ? ('dontAsk' as const)
      : mode === 'bypass-ask'
        ? ('bypassPermissions' as const)
        : ('default' as const);
  const policy =
    mode === 'preapproved'
      ? null
      : mode === 'policy-deny'
        ? ('always_deny' as const)
        : ('always_ask' as const);
  return {
    permissionMode,
    allowDangerouslySkipPermissions: mode === 'bypass-ask',
    allowedTools: ['mcp__classroom__*'],
    tools: policy ? [{ name: 'save_note', permission_policy: policy }] : [],
  };
}
export const noteText = (topic: Request['topic']) =>
  `Saved synthetic ${topic} policy classroom note.\n`;
export const outputSchema = z
  .object({
    status: z.enum(['completed', 'permission-denied', 'unavailable']),
    text: z.string().nullable(),
  })
  .strict();
