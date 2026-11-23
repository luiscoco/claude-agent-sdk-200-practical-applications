import path from 'node:path';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { query, type SDKDeferredToolUse } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { runDirectory, saveRun, loadRun, withRunLock } from './store.js';
import { publicReport } from './privacy.js';

export const topicSchema = z.enum(['MCP', 'Hooks']);
export const decisionSchema = z.enum(['approve', 'deny']);
const outputSchema = z
  .object({ status: z.enum(['completed', 'permission-denied']), text: z.string().nullable() })
  .strict();
type Call = { id: string; name: string; input: unknown };
type NativeResult = { id: string; name: string; isError: boolean; content: unknown };
type Phase = {
  stage: 'defer' | 'resume';
  sessionId: string;
  stopReason: string | null;
  deferredTool: SDKDeferredToolUse | null;
  calls: Call[];
  results: NativeResult[];
  hookEvents: Array<{ id: string; name: string; input: unknown; decision: string }>;
  callbackEvents: Array<{ id: string; name: string; input: unknown; decision: string }>;
  worker: { pid: number | null; exited: boolean; exitCode: number | null; signal: string | null };
  output: unknown;
  success: boolean;
  error: string;
  checkedAt: string;
};
export type DeferredRun = {
  id: string;
  topic: z.infer<typeof topicSchema>;
  workspace: string;
  originalInput: { file_path: string; content: string };
  status: 'new' | 'deferring' | 'deferred' | 'resuming' | 'complete' | 'failed';
  sessionId: string;
  deferredTool: SDKDeferredToolUse | null;
  decision: z.infer<typeof decisionSchema> | null;
  phases: Phase[];
  transcriptPersisted: boolean;
  actualText: string | null;
  checks: Record<string, boolean>;
  verified: boolean;
  error: string;
};
async function readOutput(file: string) {
  return readFile(file, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
}
async function hasTranscript(directory: string, sessionId: string): Promise<boolean> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  for (const entry of entries) {
    if (entry.isFile() && entry.name === sessionId + '.jsonl') return true;
    if (entry.isDirectory() && (await hasTranscript(path.join(directory, entry.name), sessionId)))
      return true;
  }
  return false;
}
async function nativePhase(state: DeferredRun, stage: 'defer' | 'resume'): Promise<Phase> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  let child: ChildProcess | undefined;
  let exitPromise: Promise<void> = Promise.resolve();
  let stderr = '';
  const phase: Phase = {
    stage,
    sessionId: '',
    stopReason: null,
    deferredTool: null,
    calls: [],
    results: [],
    hookEvents: [],
    callbackEvents: [],
    worker: { pid: null, exited: false, exitCode: null, signal: null },
    output: null,
    success: false,
    error: '',
    checkedAt: '',
  };
  const run = query({
    prompt:
      stage === 'defer'
        ? `Call Write exactly once using ${JSON.stringify(state.originalInput)}. This sensitive operation writes a synthetic owned classroom note. The host may defer the call for later approval. After a successful Write call Read exactly once on the same path and report completed with its exact text including the trailing newline. After denial report permission-denied and null text. Never retry or call tools in parallel.`
        : '',
    options: {
      cwd: state.workspace,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      resume: stage === 'resume' ? state.sessionId : undefined,
      tools: ['Write', 'Read'],
      allowedTools: ['Read'],
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: true,
      env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(state.workspace, 'native-config') },
      maxTurns: 6,
      maxBudgetUsd: 0.7,
      abortController: controller,
      outputFormat: {
        type: 'json_schema',
        schema: z.toJSONSchema(outputSchema, { target: 'draft-7' }),
      },
      spawnClaudeCodeProcess: (options) => {
        const worker = spawn(options.command, options.args, {
          cwd: options.cwd,
          env: options.env,
          signal: options.signal,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
        child = worker;
        phase.worker.pid = child.pid ?? null;
        child.stderr?.on('data', (data) => {
          stderr = (stderr + data.toString()).slice(-4000);
        });
        exitPromise = new Promise((resolve) => {
          worker.once('error', (error) => {
            phase.error = error.message;
            resolve();
          });
          worker.once('exit', (code, signal) => {
            phase.worker.exited = true;
            phase.worker.exitCode = code;
            phase.worker.signal = signal;
            resolve();
          });
        });
        return worker;
      },
      canUseTool: async (name, input, options) => {
        const exactReplay =
          stage === 'resume' &&
          name === 'Write' &&
          options.toolUseID === state.deferredTool?.id &&
          isDeepStrictEqual(input, state.originalInput);
        const approved = exactReplay && state.decision === 'approve';
        phase.callbackEvents.push({
          id: options.toolUseID,
          name,
          input,
          decision: approved ? 'allow' : 'deny',
        });
        return approved
          ? { behavior: 'allow', updatedInput: input }
          : {
              behavior: 'deny',
              message: 'Classroom operator denied this exact request or its replay did not match.',
            };
      },
      hooks: {
        PreToolUse: [
          {
            matcher: 'Write|Read',
            hooks: [
              async (input) => {
                if (input.hook_event_name !== 'PreToolUse') return {};
                const args = input.tool_input as Record<string, unknown>;
                const owned =
                  typeof args.file_path === 'string' &&
                  path.resolve(state.workspace, args.file_path) === state.originalInput.file_path;
                const exactWrite =
                  input.tool_name === 'Write' &&
                  isDeepStrictEqual(input.tool_input, state.originalInput);
                const matchingReplay =
                  stage === 'resume' && input.tool_use_id === state.deferredTool?.id;
                const firstCall = !phase.hookEvents.some((event) => event.name === input.tool_name);
                let decision: 'allow' | 'deny' | 'defer' = 'deny';
                if (firstCall && owned && exactWrite && stage === 'defer') decision = 'defer';
                if (firstCall && owned && exactWrite && matchingReplay)
                  decision = state.decision === 'approve' ? 'allow' : 'deny';
                if (
                  firstCall &&
                  owned &&
                  input.tool_name === 'Read' &&
                  stage === 'resume' &&
                  state.decision === 'approve'
                )
                  decision = 'allow';
                phase.hookEvents.push({
                  id: input.tool_use_id,
                  name: input.tool_name,
                  input: input.tool_input,
                  decision,
                });
                return {
                  hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: decision,
                    permissionDecisionReason:
                      decision === 'defer'
                        ? 'CLASSROOM_DEFERRED · Collect approval after the worker stops.'
                        : 'Classroom owner decision for the exact persisted request.',
                  },
                };
              },
            ],
          },
        ],
      },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init')
        phase.sessionId = message.session_id;
      if (message.type === 'assistant')
        for (const block of message.message.content) {
          if (block.type === 'tool_use')
            phase.calls.push({ id: block.id, name: block.name, input: block.input });
        }
      if (message.type === 'user' && Array.isArray(message.message.content))
        for (const block of message.message.content) {
          if (block.type !== 'tool_result') continue;
          const call = [...phase.calls, ...(state.deferredTool ? [state.deferredTool] : [])].find(
            (call) => call.id === block.tool_use_id,
          );
          if (call)
            phase.results.push({
              id: call.id,
              name: call.name,
              isError: Boolean(block.is_error),
              content: block.content,
            });
        }
      if (message.type === 'result') {
        phase.sessionId = message.session_id;
        phase.stopReason = message.stop_reason;
        phase.success = message.subtype === 'success' && !message.is_error;
        if (message.subtype === 'success') {
          phase.output = message.structured_output ?? null;
          phase.deferredTool = message.deferred_tool_use ?? null;
        } else phase.error = message.errors.join('\n');
      }
    }
  } catch (error) {
    phase.error = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timer);
    run.close();
    if (child) {
      await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 5000))]);
      if (!phase.worker.exited && child.pid) {
        child.kill();
        await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 2000))]);
      }
    }
  }
  if (!phase.success && !phase.error)
    phase.error = stderr || 'Native worker ended without a successful result.';
  phase.checkedAt = new Date().toISOString();
  return publicReport(phase, [process.env.ANTHROPIC_API_KEY]);
}
export async function deferRun(value: unknown) {
  if (!process.env.ANTHROPIC_API_KEY?.trim())
    throw new Error('MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.');
  const topic = topicSchema.parse(value),
    id = randomUUID();
  const workspace = path.join(runDirectory(id), 'workspace');
  await mkdir(workspace, { recursive: true });
  const state: DeferredRun = {
    id,
    topic,
    workspace,
    originalInput: {
      file_path: path.join(workspace, 'classroom-note.txt'),
      content: `Approved ${topic} deferred classroom note.\n`,
    },
    status: 'new',
    sessionId: '',
    deferredTool: null,
    decision: null,
    phases: [],
    transcriptPersisted: false,
    actualText: null,
    checks: {},
    verified: false,
    error: '',
  };
  await saveRun(state);
  return withRunLock(id, async () => {
    state.status = 'deferring';
    await saveRun(state);
    const phase = await nativePhase(state, 'defer');
    state.phases.push(phase);
    state.sessionId = phase.sessionId;
    state.deferredTool = phase.deferredTool;
    state.actualText = await readOutput(state.originalInput.file_path);
    state.transcriptPersisted = await hasTranscript(
      path.join(workspace, 'native-config', 'projects'),
      state.sessionId,
    );
    state.checks = {
      nativeDeferredStopReason: phase.stopReason === 'tool_deferred',
      exactPendingNativeTool: Boolean(
        phase.deferredTool &&
        phase.deferredTool.name === 'Write' &&
        isDeepStrictEqual(phase.deferredTool.input, state.originalInput),
      ),
      nativeDeferHookObserved: phase.hookEvents.some(
        (event) => event.id === phase.deferredTool?.id && event.decision === 'defer',
      ),
      workerStopped: phase.worker.exited,
      fileAbsentBeforeApproval: state.actualText === null,
      nativeTranscriptPersisted: state.transcriptPersisted,
    };
    state.verified = phase.success && Object.values(state.checks).every(Boolean);
    state.status = state.verified ? 'deferred' : 'failed';
    state.error =
      phase.error ||
      (state.verified ? '' : 'NATIVE_CHECK_FAILED · Inspect the actual deferral checks.');
    await saveRun(state);
    return state;
  });
}
export async function resumeRun(id: string, value: unknown) {
  const decision = decisionSchema.parse(value);
  return withRunLock(id, async () => {
    const state = await loadRun(id);
    if (state.status !== 'deferred')
      throw new Error('Only a verified deferred request can be resumed.');
    state.status = 'resuming';
    state.decision = decision;
    state.verified = false;
    await saveRun(state);
    const phase = await nativePhase(state, 'resume');
    state.phases.push(phase);
    state.actualText = await readOutput(state.originalInput.file_path);
    const nativeWrite = phase.results.find((result) => result.id === state.deferredTool?.id);
    const output = outputSchema.safeParse(phase.output);
    state.checks = {
      ...state.checks,
      sameNativeSessionResumed: phase.sessionId === state.sessionId,
      repeatedReplayDecisionsConsistent: phase.callbackEvents
        .filter((event) => event.id === state.deferredTool?.id)
        .every(
          (event) =>
            event.name === 'Write' &&
            isDeepStrictEqual(event.input, state.originalInput) &&
            event.decision === (decision === 'approve' ? 'allow' : 'deny'),
        ),
      sameToolIdentifierReplayed:
        phase.hookEvents.some(
          (event) =>
            event.id === state.deferredTool?.id &&
            event.decision === (decision === 'approve' ? 'allow' : 'deny'),
        ) ||
        phase.callbackEvents.some(
          (event) =>
            event.id === state.deferredTool?.id &&
            event.name === 'Write' &&
            isDeepStrictEqual(event.input, state.originalInput) &&
            event.decision === (decision === 'approve' ? 'allow' : 'deny'),
        ),
      newNativeWorkerStopped:
        phase.worker.exited && phase.worker.pid !== state.phases[0].worker.pid,
      originalNativeWriteResultObserved: Boolean(
        nativeWrite && nativeWrite.isError === (decision === 'deny'),
      ),
      fileMatchesApproval:
        state.actualText === (decision === 'approve' ? state.originalInput.content : null),
      nativeReadAfterApproval:
        decision === 'approve'
          ? phase.results.some((result) => result.name === 'Read' && !result.isError)
          : !phase.results.some((result) => result.name === 'Read'),
      finalMatchesNativeOutcome:
        output.success &&
        isDeepStrictEqual(output.data, {
          status: decision === 'approve' ? 'completed' : 'permission-denied',
          text: state.actualText,
        }),
    };
    state.verified = phase.success && Object.values(state.checks).every(Boolean);
    state.status = state.verified ? 'complete' : 'failed';
    state.error =
      phase.error ||
      (state.verified ? '' : 'NATIVE_CHECK_FAILED · Inspect the actual replay checks.');
    await saveRun(state);
    return state;
  });
}
