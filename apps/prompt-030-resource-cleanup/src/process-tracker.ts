import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { SpawnOptions } from '@anthropic-ai/claude-agent-sdk';

export function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}

export class ProcessTracker {
  private child?: ChildProcessWithoutNullStreams;
  private closed: Promise<void> = Promise.resolve();
  private closeObserved = false;
  private exitCode: number | null = null;
  private signal: NodeJS.Signals | null = null;
  private processEventError = '';
  private forced = false;
  private pid?: number;
  private aliveAtStart = false;

  spawn = (options: SpawnOptions) => {
    if (this.child) throw new Error('PROCESS_ALREADY_STARTED · Create a tracker per query.');
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      signal: options.signal,
      stdio: 'pipe',
      windowsHide: true,
    });
    this.child = child;
    this.pid = child.pid;
    this.aliveAtStart = Boolean(child.pid && isProcessAlive(child.pid));
    child.stderr.resume();
    this.closed = new Promise((resolve) => {
      child.once('error', (error) => {
        this.processEventError = error.message;
      });
      child.once('close', (code, signal) => {
        this.closeObserved = true;
        this.exitCode = code;
        this.signal = signal;
        resolve();
      });
    });
    return child;
  };

  private waitForClose(milliseconds: number) {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), milliseconds);
      this.closed.then(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  async verifyStopped() {
    if (this.child && !(await this.waitForClose(5000))) {
      this.forced = true;
      this.child.kill('SIGKILL');
      await this.waitForClose(5000);
    }
    const aliveAfterCleanup = this.pid === undefined ? null : isProcessAlive(this.pid);
    return {
      pid: this.pid ?? null,
      aliveAtStart: this.aliveAtStart,
      closeObserved: this.closeObserved,
      exitCode: this.exitCode,
      signal: this.signal,
      processEventError: this.processEventError,
      applicationFallbackKill: this.forced,
      aliveAfterCleanup,
      verifiedStopped: this.aliveAtStart && this.closeObserved && aliveAfterCleanup === false,
    };
  }
}
