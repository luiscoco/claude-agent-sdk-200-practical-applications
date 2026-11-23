import { z } from 'zod';
import { HOOK_EVENTS } from '@anthropic-ai/claude-agent-sdk';
export const requestSchema = z
  .object({ mode: z.enum(['callbacks', 'native-commands']), topic: z.enum(['MCP', 'Hooks']) })
  .strict();
export const lifecycleNames = [
  'SessionStart',
  'SessionEnd',
  'Notification',
  'ConfigChange',
] as const;
export const capabilitySource = 'https://code.claude.com/docs/en/agent-sdk/hooks#available-hooks';
export function capabilities(counts: Record<string, number>) {
  return lifecycleNames.map((event) => ({
    event,
    installedTypeScriptEvent: HOOK_EVENTS.includes(event),
    pythonCallbackDocumented: !['SessionStart', 'SessionEnd'].includes(event),
    actualCallbackCount: counts[event] ?? 0,
    observation: counts[event] ? 'Observed in this run' : 'Not observed in this run',
  }));
}
