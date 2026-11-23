import path from 'node:path';
import { save, load, vector, retrieve, documents } from './application.js';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const file = path.join(process.env.LAB_WORKSPACE!, 'vectors.json');
  await save(file, documents.map(doc => ({ ...doc, vector: vector(doc.text) })));
  const stored = await load<any[]>(file, []), query = 'delivery retry idempotency';
  const evidence = await exercise(mode, 'Answer the delivery retry policy using only retrieved evidence. Cite document IDs.', async input => {
    const q = vector(input);
    return stored.map(doc => ({ id: doc.id, text: doc.text, score: doc.vector.reduce((sum: number, value: number, i: number) => sum + value * q[i], 0) }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 2);
  }, query);
  const answer = evidence.observed.events.findLast(e => e.type === 'result')?.result || '';
  return report({ hits: evidence.local, vectorStoreRows: stored.length, embedding: '128-dimensional normalized hashed token vectors; no embedding model' }, { persistedVectorStore: stored.length === 3 && stored.every(doc => doc.vector.length === 128), relevantTopEvidence: evidence.local[0].id === 'D1', liveEvidenceCited: mode !== 'live' || /D1/.test(answer) }, evidence, 'Deterministic local vector retrieval and real custom MCP retrieval in live mode. Hashing is deliberately small and approximate; measure recall before choosing it for production.');
}
