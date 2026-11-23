import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query, tool, createSdkMcpServer, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, lifecycleNames, capabilities, capabilitySource } from './capabilities.js';
import { publicReport } from './privacy.js';

export async function runSessionLifecycle(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/lifecycle-'));
  await mkdir(path.join(workspace, '.claude'));
  const settingsFile = path.join(workspace, '.claude/settings.local.json');
  const originalSettings = { outputStyle: 'default' };
  await writeFile(settingsFile, JSON.stringify(originalSettings));
  const commandEventsFile = path.join(workspace, 'command-events.jsonl');
  const command = `"${process.execPath}" "${path.join(root, 'src/observe-command.cjs')}" "${commandEventsFile}"`;
  const events: Array<{ phase: string; observedAt: string; input: Record<string, unknown> }> = [];
  const phases: Array<Record<string, any>> = [];
  let sessionId: string | undefined;
  for (const phase of ['startup', 'resume']) {
    let run: ReturnType<typeof query>;
    const callbacks: Array<Record<string, any>> = [],
      executions: unknown[] = [],
      calls: Array<{ id: string; input: unknown }> = [],
      results: Array<{ id: string; isError: boolean; content: unknown }> = [];
    const expectedInput = { topic: requestedInput.topic };
    const noteText = `Owned ${requestedInput.topic} lifecycle note.`;
    const server = createSdkMcpServer({
      name: 'classroom',
      version: '1.0.0',
      alwaysLoad: true,
      tools: [
        tool(
          'note',
          'Return one owned synthetic classroom note.',
          { topic: z.enum(['MCP', 'Hooks']) },
          async (input) => {
            if (executions.length || !isDeepStrictEqual(input, expectedInput))
              throw new Error('Unexpected additional classroom note request.');
            executions.push(input);
            return { content: [{ type: 'text' as const, text: noteText }] };
          },
        ),
      ],
    });
    const observer: HookCallback = async (input) => {
      events.push({
        phase,
        observedAt: new Date().toISOString(),
        input: structuredClone(input) as unknown as Record<string, unknown>,
      });
      return {};
    };
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 150000);
    let rawResult: unknown,
      resultStatus = '',
      phaseSessionId = '',
      success = false,
      error = '';
    run = query({
      prompt: `Call mcp__classroom__note exactly once with topic ${requestedInput.topic}. After its actual result answer only LIFECYCLE_OK. Do not retry or use other tools.`,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        tools: [],
        mcpServers: {
          classroom: {
            ...server,
            tools: [{ name: 'note', permission_policy: 'always_ask' as const }],
          },
        },
        permissionMode: 'default',
        settingSources: ['project', 'local'],
        strictMcpConfig: true,
        persistSession: true,
        ...(phase === 'resume' ? { resume: sessionId } : {}),
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
          MCP_CONNECTION_NONBLOCKING: '0',
          CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
        },
        maxTurns: 5,
        maxBudgetUsd: 0.65,
        abortController: controller,
        hooks: Object.fromEntries(
          [...lifecycleNames, 'UserPromptSubmit', 'Stop'].map((name) => [
            name,
            [{ hooks: [observer] }],
          ]),
        ),
        settings:
          requestedInput.mode === 'native-commands'
            ? {
                hooks: Object.fromEntries(
                  lifecycleNames.map((name) => [
                    name,
                    [{ hooks: [{ type: 'command' as const, command }] }],
                  ]),
                ),
              }
            : {},
        canUseTool: async (name, input, options) => {
          const valid =
            name === 'mcp__classroom__note' &&
            isDeepStrictEqual(input, expectedInput) &&
            callbacks.every((item) => item.id === options.toolUseID);
          const observed: Record<string, any> = {
            name,
            input,
            id: options.toolUseID,
            valid,
            settingsUpdated: false,
            externalSettingsWritten: false,
          };
          callbacks.push(observed);
          if (!valid)
            return {
              behavior: 'deny',
              message: 'Only the selected owned classroom request is admitted.',
            };
          if (
            phase === 'startup' &&
            !callbacks.slice(0, -1).some((item) => item.externalSettingsWritten)
          ) {
            await run.updateSettings('localSettings', { outputStyle: 'Explanatory' });
            observed.settingsUpdated = true;
            observed.nativeWriterSettings = JSON.parse(await readFile(settingsFile, 'utf8'));
            await writeFile(settingsFile, JSON.stringify({ outputStyle: 'Learning' }));
            observed.externalSettingsWritten = true;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return { behavior: 'allow', updatedInput: input };
        },
      },
    });
    try {
      for await (const message of run) {
        if (message.type === 'system' && message.subtype === 'init')
          phaseSessionId = message.session_id;
        if (message.type === 'assistant' && message.parent_tool_use_id === null)
          for (const block of message.message.content)
            if (block.type === 'tool_use' && block.name === 'mcp__classroom__note')
              calls.push({ id: block.id, input: block.input });
        if (message.type === 'user' && Array.isArray(message.message.content))
          for (const block of message.message.content)
            if (block.type === 'tool_result' && calls.some((call) => call.id === block.tool_use_id))
              results.push({
                id: block.tool_use_id,
                isError: Boolean(block.is_error),
                content: block.content,
              });
        if (message.type === 'result') {
          success = message.subtype === 'success' && !message.is_error;
          phaseSessionId = message.session_id;
          resultStatus = message.subtype;
          if (message.subtype === 'success') rawResult = message.result;
          else error = message.errors.join('\n');
        }
      }
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    } finally {
      clearTimeout(timer);
      run.close();
    }
    sessionId ??= phaseSessionId;
    phases.push({
      phase,
      sessionId: phaseSessionId,
      result: rawResult,
      resultStatus,
      success,
      error,
      callbacks,
      executions,
      calls,
      results,
    });
    if (!success) break;
  }
  const commandEvents = (await readFile(commandEventsFile, 'utf8').catch(() => ''))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const finalSettings = JSON.parse(await readFile(settingsFile, 'utf8'));
  const counts = Object.fromEntries(
    lifecycleNames.map((name) => [
      name,
      events.filter((event) => event.input.hook_event_name === name).length,
    ]),
  );
  const observedCapabilities = capabilities(counts);
  const commandStarts = commandEvents.filter(
    (item) => item.input.hook_event_name === 'SessionStart',
  );
  const commandEnds = commandEvents.filter((item) => item.input.hook_event_name === 'SessionEnd');
  const checks = {
    startupAndResumeActuallySucceeded:
      phases.length === 2 && phases.every((item) => item.success && item.result === 'LIFECYCLE_OK'),
    sameNativeSessionResumed:
      phases.length === 2 && phases.every((item) => item.sessionId === sessionId),
    oneActualToolEachPhase:
      phases.length === 2 &&
      phases.every(
        (item) =>
          item.executions.length === 1 &&
          item.calls.length === 1 &&
          item.results.length === 1 &&
          !item.results[0].isError,
      ),
    actualHostPermissionRequestsCorrelate: phases.every(
      (item) =>
        item.callbacks.length > 0 &&
        item.callbacks.every(
          (callback: Record<string, any>) => callback.valid && callback.id === item.calls[0]?.id,
        ),
    ),
    nativeSettingsWriterActuallyUsed: phases[0]?.callbacks.some(
      (callback: Record<string, any>) =>
        callback.settingsUpdated && callback.nativeWriterSettings?.outputStyle === 'Explanatory',
    ),
    externalOwnedConfigEditVerified:
      phases[0]?.callbacks.some(
        (callback: Record<string, any>) => callback.externalSettingsWritten,
      ) && finalSettings.outputStyle === 'Learning',
    actualConfigChangeCallbackObserved: events.some(
      (event) =>
        event.input.hook_event_name === 'ConfigChange' &&
        event.input.source === 'local_settings' &&
        event.input.file_path === settingsFile,
    ),
    callbackSessionIdentityPreserved: events.every((event) => event.input.session_id === sessionId),
    promptAndStopAnchorsObserved:
      events.filter((event) => event.input.hook_event_name === 'UserPromptSubmit').length === 2 &&
      events.filter((event) => event.input.hook_event_name === 'Stop').length === 2,
    nativeCommandSessionSourcesMatch:
      requestedInput.mode === 'native-commands'
        ? commandStarts.length === 2 &&
          commandStarts[0].input.source === 'startup' &&
          commandStarts[1].input.source === 'resume' &&
          commandEnds.length === 2
        : commandEvents.length === 0,
    commandSessionIdentityPreserved: commandEvents.every(
      (item) => item.input.session_id === sessionId,
    ),
    installedTypeScriptNamesConfirmed: observedCapabilities.every(
      (item) => item.installedTypeScriptEvent,
    ),
    observationStatusesUseActualCounts: observedCapabilities.every(
      (item) => (item.observation === 'Observed in this run') === item.actualCallbackCount > 0,
    ),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      sessionId,
      phases,
      events,
      commandEvents,
      capabilitySource,
      capabilities: observedCapabilities,
      callbackCounts: counts,
      settingsEvidence: { file: settingsFile, original: originalSettings, final: finalSettings },
      output: {
        startupAndResume: phases.map((item) => ({
          phase: item.phase,
          sessionId: item.sessionId,
          result: item.result,
        })),
        commandStarts: commandStarts.length,
        commandEnds: commandEnds.length,
        callbackCounts: counts,
      },
      fixtureDisclosure:
        'Owned synthetic MCP note and isolated local settings; permission approval is a preselected host classroom response. Native lifecycle command logs and SDK callbacks are separate transports.',
      limitations: [
        'Notification registration is real; an absent event means not observed during this headless permission-wait experiment.',
        'SDK callback registration does not guarantee observation of startup or shutdown. Native settings-command hooks provide independently recorded session lifecycle events.',
        'Python callback availability is the linked official documentation matrix, not a Python runtime test.',
      ],
      checks,
      error: phases
        .map((item) => item.error)
        .filter(Boolean)
        .join('\n'),
      verified: Object.values(checks).every(Boolean),
      checkedAt: new Date().toISOString(),
    },
    [process.env.ANTHROPIC_API_KEY],
  );
}
