import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
export function owned(root: string, id: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(id)) throw new Error('Invalid owned identifier.');
  const value = path.resolve(root, id), relative = path.relative(path.resolve(root), value);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path escapes owned root.');
  return value;
}
export async function save(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true }); const temporary = file + '.' + randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2), { flag: 'wx' }); await rename(temporary, file);
}
export async function load<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw error; }
}
export function cleanEnvironment(workspace: string, additions: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const names = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'];
  return { ...Object.fromEntries(names.flatMap(name => process.env[name] ? [[name, process.env[name]]] : [])),
    CLAUDE_CONFIG_DIR: path.join(workspace, 'native-config'), ...additions };
}
export function vector(text: string, dimensions = 128) {
  const values = new Array<number>(dimensions).fill(0);
  for (const token of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const hash = createHash('sha256').update(token).digest(); values[hash.readUInt32LE(0) % dimensions]++;
  }
  const norm = Math.hypot(...values) || 1; return values.map(value => value / norm);
}
export const documents = [
  { id: 'D1', text: 'Delivery jobs retry at most three times. Use an idempotency key to avoid duplicate delivery.' },
  { id: 'D2', text: 'Expired jobs move to a dead-letter queue for manual review.' },
  { id: 'D3', text: 'Customer support responds within two working days.' },
];
export function retrieve(query: string, count = 2) {
  const q = vector(query);
  return documents.map(doc => ({ ...doc, score: vector(doc.text).reduce((sum, value, i) => sum + value * q[i], 0) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, count);
}
type Memory = { id: string; text: string; expiresAt: number | null; revision: number };
export class MemoryStore {
  constructor(readonly directory: string) {}
  private file(tenant: string) { return path.join(owned(this.directory, tenant), 'memory.json'); }
  async list(tenant: string, now = Date.now()) { return (await load<Memory[]>(this.file(tenant), [])).filter(m => m.expiresAt === null || m.expiresAt > now); }
  async put(tenant: string, id: string, text: string, expiresAt: number | null = null) {
    if (!text.trim() || text.length > 2000) throw new Error('Invalid memory text.');
    const values = await load<Memory[]>(this.file(tenant), []), prior = values.find(m => m.id === id);
    const memory = { id, text, expiresAt, revision: (prior?.revision ?? 0) + 1 };
    await save(this.file(tenant), [...values.filter(m => m.id !== id), memory]); return memory;
  }
  async forget(tenant: string, id: string) { await save(this.file(tenant), (await load<Memory[]>(this.file(tenant), [])).filter(m => m.id !== id)); }
}
type Job = { id: string; key: string; payload: string; state: 'queued' | 'running' | 'retry' | 'succeeded' | 'cancelled'; attempts: number; due: number; result?: string };
/** Single-writer durable classroom queue. A distributed deployment needs leases/CAS. */
export class JobQueue {
  constructor(readonly file: string) {}
  async all() { return load<Job[]>(this.file, []); }
  async enqueue(key: string, payload: string, due = Date.now()) {
    const jobs = await this.all(), prior = jobs.find(j => j.key === key); if (prior) return prior;
    const job: Job = { id: randomUUID(), key, payload, due, state: 'queued', attempts: 0 }; await save(this.file, [...jobs, job]); return job;
  }
  async cancel(id: string) { const jobs = await this.all(); const job = jobs.find(j => j.id === id); if (!job) throw new Error('Unknown job'); if (job.state === 'succeeded') throw new Error('Completed jobs cannot be cancelled'); job.state = 'cancelled'; await save(this.file, jobs); }
  async execute(worker: (payload: string, attempt: number) => Promise<string>, now = Date.now()) {
    const jobs = await this.all(), job = jobs.find(j => ['queued', 'retry'].includes(j.state) && j.due <= now); if (!job) return null;
    job.state = 'running'; job.attempts++; await save(this.file, jobs);
    try { job.result = await worker(job.payload, job.attempts); job.state = 'succeeded'; }
    catch { job.state = job.attempts < 3 ? 'retry' : 'cancelled'; job.due = now + 1000 * 2 ** (job.attempts - 1); }
    await save(this.file, jobs); return job;
  }
}
