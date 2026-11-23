import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { inspectInventory, executeExample, type Inventory } from './agent.js';
const root = path.resolve(import.meta.dirname, '..');
const app = express();
const inventories = new Map<string, Inventory>();
const reports = new Map<string, string>();
let busy = false;
app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  );
  if (
    request.method === 'POST' &&
    request.headers.origin &&
    request.headers.origin !== `http://${request.headers.host}`
  ) {
    response.status(403).json({ error: 'Unexpected request origin.' });
    return;
  }
  next();
});
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(root, 'public')));
async function save(report: object) {
  const id = randomUUID();
  const directory = path.join(root, 'runs', id);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'report.json');
  const saved = { id, ...report };
  await writeFile(file, JSON.stringify(saved, null, 2));
  reports.set(id, file);
  return saved;
}
app.post('/api/inventory', async (request, response) => {
  if (busy) {
    response.status(409).json({ error: 'Wait for the active inventory experiment.' });
    return;
  }
  busy = true;
  try {
    const inventory = await inspectInventory(request.body?.mode);
    const report = await save({ phase: 'inventory', inventory });
    if (inventory.verified) inventories.set(report.id, inventory);
    response.json(report);
  } catch (error) {
    response
      .status(422)
      .json({ error: error instanceof Error ? error.message : 'Inventory inspection failed.' });
  } finally {
    busy = false;
  }
});
app.post('/api/run', async (request, response) => {
  if (busy) {
    response.status(409).json({ error: 'Wait for the active inventory experiment.' });
    return;
  }
  const inventory = inventories.get(request.body?.inventoryId);
  if (!inventory) {
    response.status(400).json({ error: 'Inspect a successful native inventory first.' });
    return;
  }
  busy = true;
  try {
    response.json(
      await save({
        phase: 'execution',
        inventoryId: request.body.inventoryId,
        ...(await executeExample(inventory)),
      }),
    );
  } catch (error) {
    response
      .status(422)
      .json({ error: error instanceof Error ? error.message : 'Tool example failed.' });
  } finally {
    busy = false;
  }
});
const sources = [
  'src/inventory.ts',
  'src/agent.ts',
  'src/server.ts',
  'src/cli.ts',
  'fixtures/lesson-total.ts',
];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {
    response.status(404).end();
    return;
  }
  response.json({ file, files: sources, content: await readFile(path.join(root, file), 'utf8') });
});
app.get('/api/report/:id', (request, response) => {
  const file = reports.get(String(request.params.id));
  if (!file) {
    response.status(404).end();
    return;
  }
  response.download(file, 'tool-inventory-observed-report.json');
});
const port = Number(process.env.PORT || 43141);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 41 lab http://127.0.0.1:${port}`));
