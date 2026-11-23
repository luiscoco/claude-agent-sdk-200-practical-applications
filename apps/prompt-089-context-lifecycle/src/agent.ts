import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { query, tool, createSdkMcpServer, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, initialModel, targetModel, modelMatches } from './context-policy.js';
import { publicReport } from './privacy.js';

export async function runContextLifecycle(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/context-'));
  const marker = `CLASSROOM_${requestedInput.topic}_${randomBytes(4).toString('hex').toUpperCase()}`;
  const switchRequested = requestedInput.mode !== 'compact',
    switchDenied = requestedInput.mode === 'deny-switch';
  const compactRequested = ['compact', 'combined'].includes(requestedInput.mode);
  const events: Array<{ phase: string; input: Record<string, any>; returned: unknown }> = [];
  const phases: Array<Record<string, any>> = [],
    boundaries: Array<Record<string, any>> = [];
  const switchAttempts: Array<{ requestedModel: string; accepted: boolean; error: string }> = [];
  let sessionId: string | undefined;
  const sequence = compactRequested ? ['seed', 'compact', 'recall'] : ['seed'];
  for (const phase of sequence) {
    let run: ReturnType<typeof query>, switchPromise: Promise<void> | undefined;
    const calls: Array<{ id: string; input: unknown }> = [],
      results: Array<{ id: string; isError: boolean; content: unknown }> = [],
      executions: unknown[] = [],
      permissionRequests: Array<{ id: string; valid: boolean }> = [],
      assistantModels: string[] = [];
    const expectedInput = { topic: requestedInput.topic };
    const server = createSdkMcpServer({
      name: 'classroom',
      version: '1.0.0',
      alwaysLoad: true,
      tools: [
        tool(
          'note',
          'Return one owned synthetic classroom context marker.',
          { topic: z.enum(['MCP', 'Hooks']) },
          async (input) => {
            if (executions.length || !isDeepStrictEqual(input, expectedInput))
              throw new Error('Unexpected classroom marker request.');
            executions.push(input);
            return { content: [{ type: 'text' as const, text: marker }] };
          },
        ),
      ],
    });
    const observer: HookCallback = async (input) => {
      const returned =
        input.hook_event_name === 'PreModelSwitch'
          ? {
              hookSpecificOutput: {
                hookEventName: 'PreModelSwitch' as const,
                permissionDecision:
                  switchDenied || input.to_model !== targetModel
                    ? ('deny' as const)
                    : ('allow' as const),
                permissionDecisionReason: switchDenied
                  ? 'CLASSROOM_MODEL_PINNED · Keep the configured classroom model for this control.'
                  : 'Only the selected classroom model switch is admitted.',
              },
            }
          : {};
      events.push({ phase, input: structuredClone(input) as Record<string, any>, returned });
      return returned;
    };
    const context = compactRequested
      ? Array.from(
          { length: 80 },
          (_, index) =>
            `Owned classroom fact ${index + 1}: The learner studies ${requestedInput.topic} using one synthetic note and retains ${marker} for a later recall exercise.`,
        ).join('\n')
      : 'This is an owned synthetic classroom context experiment.';
    const prompt =
      phase === 'seed'
        ? `${context}\nCall mcp__classroom__note exactly once with topic ${requestedInput.topic}. Remember its exact marker. Then answer only CLASSROOM_SEEDED.`
        : phase === 'compact'
          ? `/compact Preserve the exact classroom marker ${marker} and topic ${requestedInput.topic} for recall.`
          : 'Return the exact classroom marker from the earlier tool result in the marker field. Do not add Markdown, quotes or other text inside that field. Do not call a classroom lookup.';
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 210000);
    let success = false,
      resultStatus = '',
      resultText = '',
      error = '',
      phaseSessionId = '';
    let structuredOutput: unknown;
    run = query({
      prompt,
      options: {
        cwd: workspace,
        model: process.env.CLAUDE_MODEL || initialModel,
        tools: [],
        settingSources: [],
        strictMcpConfig: true,
        persistSession: true,
        ...(sessionId ? { resume: sessionId } : {}),
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'),
          MCP_CONNECTION_NONBLOCKING: '0',
          CLAUDE_CODE_MCP_STARTUP_WAIT_MS: '60000',
        },
        maxTurns: 5,
        maxBudgetUsd: 1.1,
        abortController: controller,
        ...(phase === 'recall'
          ? {
              outputFormat: {
                type: 'json_schema' as const,
                schema: {
                  type: 'object',
                  properties: { marker: { type: 'string' } },
                  required: ['marker'],
                  additionalProperties: false,
                },
              },
            }
          : {}),
        hooks: Object.fromEntries(
          ['PreCompact', 'PostCompact', 'PreModelSwitch', 'PostModelSwitch'].map((name) => [
            name,
            [{ hooks: [observer] }],
          ]),
        ),
        ...(phase === 'seed'
          ? {
              mcpServers: {
                classroom: {
                  ...server,
                  tools: [{ name: 'note', permission_policy: 'always_ask' as const }],
                },
              },
              canUseTool: async (
                name: string,
                input: Record<string, unknown>,
                options: { toolUseID: string },
              ) => {
                const valid =
                  name === 'mcp__classroom__note' &&
                  isDeepStrictEqual(input, expectedInput) &&
                  permissionRequests.every((item) => item.id === options.toolUseID);
                permissionRequests.push({ id: options.toolUseID, valid });
                if (!valid)
                  return {
                    behavior: 'deny' as const,
                    message: 'Only the owned classroom marker request is admitted.',
                  };
                if (switchRequested) {
                  switchPromise ??= (async () => {
                    const attempt = { requestedModel: targetModel, accepted: false, error: '' };
                    switchAttempts.push(attempt);
                    try {
                      await run.setModel(targetModel);
                      attempt.accepted = true;
                    } catch (failure) {
                      attempt.error = failure instanceof Error ? failure.message : String(failure);
                    }
                  })();
                  await switchPromise;
                }
                return { behavior: 'allow' as const, updatedInput: input };
              },
            }
          : {}),
      },
    });
    try {
      for await (const message of run) {
        if (message.type === 'system' && message.subtype === 'init')
          phaseSessionId = message.session_id;
        if (message.type === 'system' && message.subtype === 'compact_boundary')
          boundaries.push(structuredClone(message));
        if (message.type === 'assistant') {
          assistantModels.push(message.message.model);
          for (const block of message.message.content)
            if (block.type === 'tool_use' && block.name === 'mcp__classroom__note')
              calls.push({ id: block.id, input: block.input });
        }
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
          if (message.subtype === 'success') {
            resultText = message.result;
            structuredOutput = message.structured_output;
          } else error = message.errors.join('\n');
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
      prompt:
        phase === 'seed'
          ? 'Owned synthetic classroom context plus one native marker lookup.'
          : prompt,
      sessionId: phaseSessionId,
      success,
      resultStatus,
      resultText,
      structuredOutput,
      error,
      assistantModels,
      calls,
      results,
      executions,
      permissionRequests,
    });
    if (!success) break;
  }
  const preSwitch = events.filter((event) => event.input.hook_event_name === 'PreModelSwitch'),
    postSwitch = events.filter((event) => event.input.hook_event_name === 'PostModelSwitch');
  const preCompact = events.filter((event) => event.input.hook_event_name === 'PreCompact'),
    postCompact = events.filter((event) => event.input.hook_event_name === 'PostCompact');
  const boundary = boundaries[0]?.compact_metadata;
  const checks = {
    actualNativePhasesSucceeded:
      phases.length === sequence.length && phases.every((item) => item.success),
    sameNativeSessionPreserved: phases.every((item) => item.sessionId === sessionId),
    actualMarkerLookupSucceeded:
      phases[0]?.calls.length === 1 &&
      phases[0]?.results.length === 1 &&
      !phases[0].results[0].isError &&
      phases[0].executions.length === 1 &&
      phases[0].resultText === 'CLASSROOM_SEEDED',
    actualPermissionRequestCorrelates:
      phases[0]?.permissionRequests.length > 0 &&
      phases[0].permissionRequests.every(
        (item: { id: string; valid: boolean }) => item.valid && item.id === phases[0].calls[0]?.id,
      ),
    modelSwitchAttemptMatchesSelection:
      switchAttempts.length === (switchRequested ? 1 : 0) &&
      switchAttempts.every(
        (attempt) =>
          attempt.accepted === !switchDenied &&
          (switchDenied ? attempt.error.includes('CLASSROOM_MODEL_PINNED') : !attempt.error),
      ),
    actualPreModelSwitchMatches:
      preSwitch.length === (switchRequested ? 1 : 0) &&
      preSwitch.every(
        (event) => event.input.to_model === targetModel && event.input.source === 'sdk',
      ),
    actualPostModelSwitchMatches:
      postSwitch.filter((event) => event.input.source === 'sdk').length ===
      (switchRequested && !switchDenied ? 1 : 0),
    actualAssistantModelMatchesSwitch:
      phases[0]?.assistantModels.some((model: string) => modelMatches(model, targetModel)) ===
      (switchRequested && !switchDenied),
    actualCompactionHooksMatch:
      preCompact.length === (compactRequested ? 1 : 0) &&
      postCompact.length === (compactRequested ? 1 : 0) &&
      [...preCompact, ...postCompact].every((event) => event.input.trigger === 'manual'),
    actualCompactBoundaryMatches: compactRequested
      ? boundaries.length === 1 &&
        boundary.trigger === 'manual' &&
        boundary.pre_tokens > boundary.post_tokens
      : boundaries.length === 0,
    actualSummaryPreservesMarker: compactRequested
      ? postCompact[0]?.input.compact_summary.includes(marker)
      : true,
    actualRecallPreservesMarker: compactRequested
      ? phases.at(-1)?.phase === 'recall' &&
        phases.at(-1)?.structuredOutput?.marker === marker &&
        phases.at(-1)?.calls.length === 0
      : true,
    nativeHookSessionsCorrelate: events.every((event) => event.input.session_id === sessionId),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      marker,
      sessionId,
      initialModel: process.env.CLAUDE_MODEL || initialModel,
      targetModel,
      phases,
      events,
      switchAttempts,
      boundaries,
      output: {
        seedResult: phases[0]?.resultText,
        actualSeedModels: phases[0]?.assistantModels,
        switchAccepted: switchAttempts[0]?.accepted ?? null,
        compaction: boundary
          ? {
              trigger: boundary.trigger,
              preTokens: boundary.pre_tokens,
              postTokens: boundary.post_tokens,
              droppedTokens: boundary.cumulative_dropped_tokens,
            }
          : null,
        recall: compactRequested ? (phases.at(-1)?.structuredOutput?.marker ?? null) : null,
      },
      fixtureDisclosure:
        'Owned synthetic classroom context and random marker. A denied model switch is an explicit pre-hook control. Manual compaction and recall use the actual persisted native session.',
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
