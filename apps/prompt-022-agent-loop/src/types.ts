import type { Statistics } from './numbers.js';
export type Mode = 'agent' | 'verify';
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export interface RunEvent {
  id: number; at: string; type: string; title: string; detail: string;
  source?: string; data?: unknown;
}
export interface AgentInput {
  file: string; directory: string; signal: AbortSignal;
  emit: (type: string, title: string, detail: string, source?: string, data?: unknown) => Promise<void>;
}
export interface AgentAnswer { statistics: unknown; model?: string; sessionId?: string; estimatedCostUsd?: number; readCalls: number }
export interface Report {
  runId: string; mode: Mode; createdAt: string; sourceFile: string;
  sourceSha256: string; input: number[]; expected: Statistics;
  actual: Statistics; verified: true; agent?: Omit<AgentAnswer, 'statistics'>;
}
export interface Run {
  id: string; mode: Mode; status: RunStatus; events: RunEvent[];
  report?: Report; error?: { code: string; message: string; line?: number };
  controller: AbortController; finished: Promise<void>;
  listeners: Set<(event: RunEvent) => void>;
}
