import path from 'node:path';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { query, HOOK_EVENTS, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { installedInventory } from './inventory.js';
import { publicReport } from './privacy.js';

export const requestSchema = z.object({ topic: z.enum(['MCP', 'Hooks']) }).strict();
const outputSchema = z.object({ topic: z.enum(['MCP', 'Hooks']), text: z.string() }).strict();
export async function runInventoryProbe(value: unknown) {
  const requestedInput = requestSchema.parse(value),
    inventory = await installedInventory();
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error(
      'MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally for the native hook probe.',
    );
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/hooks-'));
  const noteFile = path.join(workspace, 'classroom-note.txt');
  const expectedText = `Synthetic ${requestedInput.topic} hook inventory note.\n`;
  await writeFile(noteFile, expectedText);
  const events: Array<{
    event: string;
    nativeToolUseId: string | null;
    input: unknown;
    observedAt: string;
  }> = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; isError: boolean; content: unknown }> = [];
  let admittedReadId: string | undefined;
  const observeHook: HookCallback = async (input, toolUseId) => {
    events.push({
      event: input.hook_event_name,
      nativeToolUseId: 'tool_use_id' in input ? input.tool_use_id : (toolUseId ?? null),
      input,
      observedAt: new Date().toISOString(),
    });
    if (input.hook_event_name === 'PreToolUse') {
      const args = input.tool_input as Record<string, unknown>;
      const valid =
        (!admittedReadId || admittedReadId === input.tool_use_id) &&
        input.tool_name === 'Read' &&
        typeof args.file_path === 'string' &&
        path.resolve(workspace, args.file_path) === noteFile;
      if (!valid)
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: 'Unexpected additional classroom Read or path.',
          },
        };
      admittedReadId = input.tool_use_id;
    }
    return {};
  };
  const toolEvents = new Set(['PreToolUse', 'PostToolUse', 'PostToolUseFailure']);
  const hooks = Object.fromEntries(
    HOOK_EVENTS.map((event) => [
      event,
      [
        {
          ...(toolEvents.has(event) ? { matcher: 'Read' } : {}),
          hooks: [observeHook],
        },
      ],
    ]),
  );
  let rawOutput: unknown,
    success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 180000);
  const run = query({
    prompt: `Call Read exactly once on ${JSON.stringify(noteFile)}, then report topic ${requestedInput.topic} and the complete exact text including the trailing newline. Use no other tool. This is a synthetic owned classroom fixture used to observe actual SDK hooks.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: ['Read'],
      allowedTools: [],
      permissionMode: 'default',
      hooks,
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 5,
      maxBudgetUsd: 0.65,
      abortController: controller,
      canUseTool: async () => ({
        behavior: 'deny',
        message: 'Unexpected approval request in the read-only classroom probe.',
      }),
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') sessionId = message.session_id;
      if (message.type === 'assistant')
        for (const block of message.message.content) {
          if (block.type === 'tool_use' && block.name === 'Read')
            calls.push({ id: block.id, name: block.name, input: block.input });
        }
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type === 'tool_result' && calls.some((call) => call.id === block.tool_use_id))
            results.push({
              id: block.tool_use_id,
              isError: Boolean(block.is_error),
              content: block.content,
            });
        }
      if (message.type === 'result') {
        success = message.subtype === 'success' && !message.is_error;
        sessionId = message.session_id;
        resultStatus = message.subtype;
        if (message.subtype === 'success') rawOutput = message.structured_output;
        else error = message.errors.join('\n');
      }
    }
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    clearTimeout(timer);
    run.close();
  }
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const actualText = await readFile(noteFile, 'utf8');
  const observedNames = [...new Set(events.map((event) => event.event))];
  const checks = {
    everyInstalledEventHasUseCase: inventory.unmappedEvents.length === 0,
    registeredEveryInstalledHook: Object.keys(hooks).length === inventory.count,
    nativePreToolHookObserved: events.some(
      (event) => event.event === 'PreToolUse' && event.nativeToolUseId === calls[0]?.id,
    ),
    nativePostToolHookObserved: events.some(
      (event) => event.event === 'PostToolUse' && event.nativeToolUseId === calls[0]?.id,
    ),
    oneNativeReadCompleted: calls.length === 1 && results.length === 1 && !results[0].isError,
    actualFilePreserved: actualText === expectedText,
    finalMatchesActualFile: output?.topic === requestedInput.topic && output?.text === actualText,
  };
  return publicReport(
    {
      requestedInput,
      inventory,
      registeredEvents: [...HOOK_EVENTS],
      observedNames,
      unobservedNames: HOOK_EVENTS.filter((event) => !observedNames.includes(event)),
      events,
      calls,
      results,
      output,
      actualText,
      checks,
      success,
      sessionId,
      resultStatus,
      error,
      verified: !error && success && Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
