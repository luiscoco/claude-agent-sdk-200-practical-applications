import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { FileSessionStore } from './store.js';
import { native, requireNative, report } from './native.js';
import { recall } from './live.js';
export async function run(mode: string) {
  const store = new FileSessionStore(path.join(process.env.LAB_RUN!, 'store'));
  const key = { projectKey: 'contract-fixture', sessionId: randomUUID() };
  const one = { type: 'user', uuid: randomUUID(), message: { nested: ['opaque', { value: 42 }] } };
  const two = { type: 'assistant', uuid: randomUUID(), message: 'second' };
  const metadata = { type: 'custom-title', customTitle: 'Classroom' };
  const missing = await store.load(key);
  await Promise.all([store.append(key, [one, metadata]), store.append(key, [one, two, metadata])]);
  const loaded = await new FileSessionStore(store.directory).load(key);
  const marker = 'STORE_' + randomUUID();
  const seed = await native(`Owned classroom marker ${marker}. Preserve this fact across session-store resume.`, { sessionStore: store }, mode === 'live');
  const sessionId = requireNative(seed, mode !== 'live');
  const actualKey = { projectKey: process.env.CLAUDE_CODE_PROJECT_DIR_NAME!, sessionId };
  const mirrored = await store.load(actualKey);
  const remembered = mode === 'live' ? await recall(sessionId, marker, { sessionStore: new FileSessionStore(store.directory) }) : null;
  return report({ key, entries: loaded, nativeSessionId: sessionId, mirrored }, {
    missingReturnsNull: missing === null,
    orderedAppendAndUuidDeduplication: JSON.stringify(loaded) === JSON.stringify([one, metadata, two, metadata]),
    opaquePayloadRoundTrips: JSON.stringify(loaded?.[0]) === JSON.stringify(one),
    uuidlessMetadataRetained: loaded?.filter(e => !e.uuid).length === 2,
    nativeTranscriptActuallyMirrored: Boolean(mirrored?.some(e => e.uuid === seed.promptId)),
    ...(remembered ? { liveModelRecallsMarkerFromStore: remembered.remembered } : {}),
  }, { seed, remembered }, 'A persistent local filesystem adapter implementing the actual SDK SessionStore contract. Live mode calls the model before and after store resumption and checks an exact random fact. Same-key writes across processes need database transactions or a distributed lock; this classroom adapter serializes within one process.');
}
