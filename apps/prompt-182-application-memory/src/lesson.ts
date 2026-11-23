import path from 'node:path';
import { MemoryStore } from './application.js';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const directory = path.join(process.env.LAB_WORKSPACE!, 'memory'), store = new MemoryStore(directory);
  await store.put('alice', 'language', 'Spanish'); const corrected = await store.put('alice', 'language', 'English');
  await store.put('alice', 'temporary', 'Expired fixture', 1000); await store.put('alice', 'delete-me', 'Forget this'); await store.forget('alice', 'delete-me');
  await store.put('bob', 'language', 'French'); const restarted = new MemoryStore(directory), items = await restarted.list('alice', 2000);
  const evidence = await exercise(mode, 'Use the application memory tool to describe Alice’s current language preference. Cite its memory ID.', async () => restarted.list('alice', 2000), 'alice');
  return report(items, { correctedRevision: corrected.revision === 2, expiredHidden: !items.some(item => item.id === 'temporary'), deletedGone: !items.some(item => item.id === 'delete-me'), persistedAfterReload: items.length === 1 && items[0].text === 'English', tenantSeparated: (await restarted.list('bob'))[0].text === 'French' }, evidence, 'Application-owned single-writer JSON memory. Expired entries are excluded from retrieval, while deletion physically removes the entry from current storage. Backups need their own retention policy.');
}
