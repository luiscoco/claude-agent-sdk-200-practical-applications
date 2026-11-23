import { mkdir, readFile, rename, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { SessionStore, SessionKey, SessionStoreEntry } from '@anthropic-ai/claude-agent-sdk';

type RecordFile = { key: SessionKey; entries: SessionStoreEntry[]; mtime: number };
/** A local persistent teaching adapter, shared by independent worker processes.
 * Atomic replacement + an in-process queue. Multiple writers to the SAME key
 * from different processes require a database transaction or distributed lock.
 */
export class FileSessionStore implements SessionStore {
  private tails = new Map<string, Promise<unknown>>();
  constructor(readonly directory: string) {}
  private file(key: SessionKey) {
    if (!key.projectKey || !key.sessionId || key.subpath === '') throw new Error('Invalid session key.');
    return path.join(this.directory, createHash('sha256').update(JSON.stringify([
      key.projectKey, key.sessionId, key.subpath ?? null,
    ])).digest('hex') + '.json');
  }
  private serialize<T>(key: SessionKey, operation: () => Promise<T>): Promise<T> {
    const file = this.file(key);
    const pending = (this.tails.get(file) ?? Promise.resolve()).catch(() => {}).then(operation);
    this.tails.set(file, pending);
    void pending.finally(() => { if (this.tails.get(file) === pending) this.tails.delete(file); }).catch(() => {});
    return pending;
  }
  private async read(key: SessionKey): Promise<RecordFile | null> {
    try { return JSON.parse(await readFile(this.file(key), 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  append(key: SessionKey, batch: SessionStoreEntry[]) {
    if (!batch.length) return Promise.resolve();
    // Snapshot at invocation so callers cannot mutate queued inputs.
    const incoming = JSON.parse(JSON.stringify(batch)) as SessionStoreEntry[];
    return this.serialize(key, async () => {
      await mkdir(this.directory, { recursive: true });
      const old = await this.read(key);
      const entries = old?.entries ?? [];
      const seen = new Set(entries.flatMap(e => typeof e.uuid === 'string' ? [e.uuid] : []));
      for (const entry of incoming) {
        if (typeof entry.uuid === 'string') {
          if (seen.has(entry.uuid)) continue;
          seen.add(entry.uuid);
        }
        entries.push(entry); // Keep EVERY UUID-less metadata entry.
      }
      const file = this.file(key), temporary = file + '.' + randomUUID() + '.tmp';
      await writeFile(temporary, JSON.stringify({ key, entries, mtime: Date.now() }), { flag: 'wx' });
      await rename(temporary, file);
    });
  }
  load(key: SessionKey) { return this.serialize(key, async () => (await this.read(key))?.entries ?? null); }
  private async records(): Promise<RecordFile[]> {
    await mkdir(this.directory, { recursive: true });
    const files = await readdir(this.directory);
    return Promise.all(files.filter(f => /^[a-f0-9]{64}\.json$/.test(f))
      .map(async f => JSON.parse(await readFile(path.join(this.directory, f), 'utf8'))));
  }
  async listSessions(projectKey: string) {
    return (await this.records()).filter(r => r.key.projectKey === projectKey && !r.key.subpath)
      .map(r => ({ sessionId: r.key.sessionId, mtime: r.mtime }));
  }
  async listSubkeys(key: { projectKey: string; sessionId: string }) {
    return (await this.records()).filter(r => r.key.projectKey === key.projectKey &&
      r.key.sessionId === key.sessionId && r.key.subpath).map(r => r.key.subpath!);
  }
  async delete(key: SessionKey) {
    for (const record of await this.records()) {
      if (record.key.projectKey === key.projectKey && record.key.sessionId === key.sessionId &&
          (key.subpath === undefined || record.key.subpath === key.subpath))
        await this.serialize(record.key, () => unlink(this.file(record.key)));
    }
  }
}
