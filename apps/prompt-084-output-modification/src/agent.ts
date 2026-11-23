import path from 'node:path';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, outputSchema, sanitizeText, replaceReadContent } from './sanitize.js';
import { publicReport } from './privacy.js';

export async function runOutputRewrite(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/output-'));
  const fixture = path.join(workspace, 'synthetic-record.txt');
  const tag = randomBytes(4).toString('hex');
  const syntheticMarkers = {
    email: `student-${tag}@example.invalid`,
    token: `CLASSROOM_TOKEN_${tag.toUpperCase()}`,
  };
  const originalText = `Topic: ${requestedInput.topic}\nEmail: ${syntheticMarkers.email}\nAccess: ${syntheticMarkers.token}\n`;
  await writeFile(fixture, originalText);
  const redactionExpected = ['sanitize', 'replace'].includes(requestedInput.mode);
  const transformedText =
    requestedInput.mode === 'replace'
      ? `Only the ${requestedInput.topic} classroom topic is available.\n`
      : sanitizeText(originalText);
  const expectedText = redactionExpected ? transformedText : originalText;
  const hooks: Array<{ id: string; originalResponse: unknown; returned: unknown }> = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; isError: boolean; content: unknown }> = [];
  const permissionRequests: Array<{ id: string; name: string }> = [];
  let admittedId: string | null = null,
    rawOutput: unknown,
    success = false,
    error = '',
    sessionId = '',
    resultStatus = '';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 180000);
  const run = query({
    prompt: `Read the owned synthetic classroom file ${JSON.stringify(fixture)} exactly once. Then return completed and the exact text actually delivered by the Read result, including its trailing newline. Exclude only the native line-number prefixes if present. Do not summarize or infer hidden content. Do not retry or call another tool.`,
    options: {
      cwd: workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      tools: ['Read'],
      allowedTools: ['Read'],
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      settings: {
        permissions: {
          blockReadsOutsideWorkingDirectories: true,
          blockWritesOutsideWorkingDirectories: true,
        },
      },
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config') },
      maxTurns: 5,
      maxBudgetUsd: 0.65,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      canUseTool: async (name, _input, options) => {
        permissionRequests.push({ id: options.toolUseID, name });
        return {
          behavior: 'deny',
          message: 'Unexpected host approval request in the preapproved Read experiment.',
        };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Read',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const args = input.tool_input as Record<string, unknown>;
                if (
                  args.file_path === fixture &&
                  (!admittedId || admittedId === input.tool_use_id)
                ) {
                  admittedId = input.tool_use_id;
                  return {};
                }
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: 'deny',
                    permissionDecisionReason: 'Only this owned synthetic record is admitted.',
                  },
                };
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: 'Read',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PostToolUse') return {};
                const originalResponse = structuredClone(input.tool_response);
                const updatedToolOutput =
                  requestedInput.mode === 'invalid-shape'
                    ? transformedText
                    : replaceReadContent(originalResponse, transformedText);
                const returned =
                  requestedInput.mode === 'baseline'
                    ? {}
                    : {
                        hookSpecificOutput: {
                          hookEventName: 'PostToolUse' as const,
                          updatedToolOutput,
                        },
                      };
                hooks.push({ id: input.tool_use_id, originalResponse, returned });
                return returned;
              },
            ],
          },
        ],
      },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') sessionId = message.session_id;
      if (message.type === 'assistant')
        for (const block of message.message.content)
          if (block.type === 'tool_use' && block.name === 'Read')
            calls.push({ id: block.id, name: block.name, input: block.input });
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
  const actualFileText = await readFile(fixture, 'utf8');
  const parsed = outputSchema.safeParse(rawOutput),
    output = parsed.success ? parsed.data : null;
  const delivered = JSON.stringify(results[0]?.content ?? null);
  const modelText = JSON.stringify(output);
  const markers = Object.values(syntheticMarkers);
  const checks = {
    oneActualNativeRead: calls.length === 1 && results.length === 1 && !results[0].isError,
    originalReadObservedByPostHook:
      hooks.length === 1 &&
      hooks[0].id === calls[0]?.id &&
      (hooks[0].originalResponse as { file?: { content?: string } })?.file?.content ===
        originalText,
    replacementShapeMatchesSelection:
      hooks.length === 1 &&
      (requestedInput.mode === 'baseline'
        ? isDeepStrictEqual(hooks[0].returned, {})
        : isDeepStrictEqual(hooks[0].returned, {
            hookSpecificOutput: {
              hookEventName: 'PostToolUse',
              updatedToolOutput:
                requestedInput.mode === 'invalid-shape'
                  ? transformedText
                  : replaceReadContent(hooks[0].originalResponse, transformedText),
            },
          })),
    actualDeliveryMarkerPresenceMatches: markers.every(
      (marker) => delivered.includes(marker) === !redactionExpected,
    ),
    actualModelMarkerPresenceMatches: markers.every(
      (marker) => modelText.includes(marker) === !redactionExpected,
    ),
    exactFinalMatchesActualDelivery: isDeepStrictEqual(output, {
      status: 'completed',
      text: expectedText,
    }),
    sourceFileUnchanged: actualFileText === originalText,
    preapprovalAvoidedHostCallback: permissionRequests.length === 0,
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      configuration: { tool: 'Read', allowedTools: ['Read'], outputRewriteOnly: true },
      fixtureDisclosure:
        'All email and token values are generated synthetic classroom markers, not real personal data or credentials.',
      syntheticMarkers,
      originalText,
      expectedText,
      hooks,
      calls,
      results,
      permissionRequests,
      deliveryEvidence: {
        originalMarkersPresent: markers.some((marker) => delivered.includes(marker)),
        expectedRedaction: redactionExpected,
        modelMarkersPresent: markers.some((marker) => modelText.includes(marker)),
      },
      fileEvidence: {
        file: 'synthetic-record.txt',
        originalText,
        actualFileText,
        unchanged: actualFileText === originalText,
      },
      output,
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
