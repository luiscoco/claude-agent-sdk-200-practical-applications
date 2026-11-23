import { spawn } from 'node:child_process';
import { inspect } from './capabilities.js';
import { native, requireNative, report } from './native.js';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
export async function run(mode: string) {
  const spawned: any[] = [];
  const options: Options = { spawnClaudeCodeProcess: spec => {
    const child = spawn(spec.command, spec.args, { cwd: spec.cwd, env: spec.env,
      signal: spec.signal, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    spawned.push({ pid: child.pid, cwd: spec.cwd, executable: spec.command, argCount: spec.args.length,
      protocolTransport: 'unmodified stdin/stdout pipes', forwardedSignal: Boolean(spec.signal) });
    // Never write wrapper diagnostics into the JSON protocol stdout stream.
    return child;
  } };
  const observed = await inspect(options);
  const live = mode === 'live' ? await native('Reply only CUSTOM_TRANSPORT_OK.', options, true) : null;
  if (live) requireNative(live, false);
  return report({ spawned }, { actualCustomSpawnerUsed: spawned.length >= 1 && spawned.every(p => Boolean(p.pid)),
    nativeProtocolRemainsValid: observed.result.num_turns === 0,
    ...(live ? { modelRunsThroughCustomTransport: live.events.some(e => e.type === 'result' && e.result?.trim() === 'CUSTOM_TRANSPORT_OK') } : {}),
  }, { observed, live }, 'The version-sensitive adapter implements the public SpawnedProcess contract using a normal child process. It passes through the SDK-owned abort signal and never logs environment values. This is a local transport prototype, not a claimed remote/container deployment.');
}
