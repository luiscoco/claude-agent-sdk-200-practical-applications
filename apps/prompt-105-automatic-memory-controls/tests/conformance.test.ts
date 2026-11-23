import { mkdtemp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { runSessionStoreConformance } from './official-conformance.js';
import { FileSessionStore } from '../src/store.js';
runSessionStoreConformance(async () => { const base = path.resolve('runs/conformance'); await mkdir(base, { recursive: true }); return new FileSessionStore(await mkdtemp(path.join(base, 'contract-'))); });
