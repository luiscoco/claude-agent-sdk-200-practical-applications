import path from 'node:path';
import { mkdir, mkdtemp, writeFile, readFile, symlink, realpath } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { requestSchema, inspectPath, outputSchema } from './path-policy.js';
import { publicReport } from './privacy.js';

export async function runPathPolicy(value: unknown) {
  const requestedInput = requestSchema.parse(value);
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const root = path.resolve(import.meta.dirname, '..');
  await mkdir(path.join(root, 'runs'), { recursive: true });
  const workspace = await mkdtemp(path.join(root, 'runs/path-'));
  const allowedDirectory = path.join(workspace, 'allowed');
  const restrictedDirectory = path.join(workspace, 'restricted');
  const siblingDirectory = path.join(workspace, 'allowed-neighbor');
  for (const directory of [allowedDirectory, restrictedDirectory, siblingDirectory])
    await mkdir(directory);
  const allowedFile = path.join(allowedDirectory, 'note.txt');
  const restrictedFile = path.join(restrictedDirectory, 'note.txt');
  const siblingFile = path.join(siblingDirectory, 'note.txt');
  const fixtureText = {
    allowed: `Allowed synthetic ${requestedInput.topic} classroom note.\n`,
    restricted: `Restricted synthetic ${requestedInput.topic} classroom note.\n`,
    sibling: `Sibling synthetic ${requestedInput.topic} classroom note.\n`,
  };
  await writeFile(allowedFile, fixtureText.allowed);
  await writeFile(restrictedFile, fixtureText.restricted);
  await writeFile(siblingFile, fixtureText.sibling);
  if (requestedInput.mode === 'alias')
    await symlink(restrictedDirectory, path.join(allowedDirectory, 'alias'), 'junction');
  const requestedFile = {
    allowed: allowedFile,
    restricted: restrictedFile,
    alias: path.join(allowedDirectory, 'alias', 'note.txt'),
    sibling: siblingFile,
    'no-hook': restrictedFile,
  }[requestedInput.mode];
  const canonicalRequested = await realpath(requestedFile);
  const beforeText = await readFile(requestedFile, 'utf8');
  const enforcementEnabled = requestedInput.mode !== 'no-hook';
  const allowed = ['allowed', 'no-hook'].includes(requestedInput.mode);
  const observedRequests: Array<{
    id: string;
    requestedPath: unknown;
    canonicalTarget: string | null;
    canonicalDirectory: string | null;
    allowed: boolean;
    reason: string;
  }> = [];
  const calls: Array<{ id: string; name: string; input: unknown }> = [];
  const results: Array<{ id: string; isError: boolean; content: unknown }> = [];
  const permissionRequests: Array<{ id: string; name: string }> = [];
  let initialTools: string[] = [],
    rawOutput: unknown;
  let success = false,
    sessionId = '',
    resultStatus = '',
    error = '';
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 180000);
  const run = query({
    prompt: `Call Read exactly once on ${JSON.stringify(requestedFile)}. This is an owned synthetic classroom fixture. After an actual successful Read report completed with its exact text including the trailing newline. After an actual native denial report permission-denied and null text. Never retry or call another tool.`,
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
      hooks: enforcementEnabled
        ? {
            PreToolUse: [
              {
                matcher: 'Read',
                hooks: [
                  async (input) => {
                    if (input.hook_event_name !== 'PreToolUse') return {};
                    const args = input.tool_input as Record<string, unknown>;
                    let admission: Awaited<ReturnType<typeof inspectPath>> | null = null;
                    let reason =
                      'PATH_RESTRICTED · The native Read target is outside the allowed classroom directory.';
                    try {
                      if (typeof args.file_path !== 'string')
                        throw new Error('Read requires a file path.');
                      admission = await inspectPath(workspace, allowedDirectory, args.file_path);
                    } catch {
                      reason =
                        'PATH_UNRESOLVED · The requested classroom target could not be resolved.';
                    }
                    observedRequests.push({
                      id: input.tool_use_id,
                      requestedPath: args.file_path,
                      canonicalTarget: admission?.canonicalTarget ?? null,
                      canonicalDirectory: admission?.canonicalDirectory ?? null,
                      allowed: Boolean(admission?.allowed),
                      reason: admission?.allowed ? 'Owned canonical path admitted.' : reason,
                    });
                    if (admission?.allowed) return {};
                    return {
                      hookSpecificOutput: {
                        hookEventName: 'PreToolUse',
                        permissionDecision: 'deny',
                        permissionDecisionReason: reason,
                      },
                    };
                  },
                ],
              },
            ],
          }
        : {},
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        initialTools = message.tools;
        sessionId = message.session_id;
      }
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
  const afterText = await readFile(requestedFile, 'utf8');
  const checks = {
    nativeReadAdvertised: initialTools.includes('Read'),
    oneActualNativeRead: calls.length === 1 && results.length === 1,
    preapprovalAvoidedHostCallback: permissionRequests.length === 0,
    pathHookPresenceMatches: enforcementEnabled
      ? observedRequests.length > 0
      : observedRequests.length === 0,
    actualCanonicalTargetMatchesFixture: observedRequests.every((request) =>
      Boolean(
        request.canonicalTarget &&
        path.relative(canonicalRequested, request.canonicalTarget) === '',
      ),
    ),
    actualHookDecisionMatches: observedRequests.every(
      (request) => request.id === calls[0]?.id && request.allowed === allowed,
    ),
    nativeReadOutcomeMatches: results.length === 1 && results[0].isError === !allowed,
    ownedFixturePreserved: beforeText === afterText,
    finalMatchesNativeOutcome: isDeepStrictEqual(output, {
      status: allowed ? 'completed' : 'permission-denied',
      text: allowed ? afterText : null,
    }),
  };
  return publicReport(
    {
      requestedInput,
      workspace,
      configuration: {
        tools: ['Read'],
        allowedTools: ['Read'],
        permissionMode: 'default',
        enforcementEnabled,
      },
      requestedRelativePath: path.relative(workspace, requestedFile),
      canonicalRelativePath: path.relative(workspace, canonicalRequested),
      initialTools,
      observedRequests,
      permissionRequests,
      calls,
      results,
      fileEvidence: {
        fixturePreserved: beforeText === afterText,
        returnedText: allowed ? afterText : null,
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
