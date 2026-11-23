import express from 'express';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { defaultQuestion, demoImage, runImage } from './agent.js';

const root = path.resolve(import.meta.dirname, '..');
const app = express();
const reports = new Map<string, { file: string; image: string; mediaType: string }>();
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
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(root, 'public')));
app.get('/api/config', (_request, response) => response.json({ defaultQuestion }));
app.post('/api/run', async (request, response) => {
  if (busy) {
    response.status(409).json({ error: 'Wait for the active image analysis.' });
    return;
  }
  busy = true;
  try {
    const report = {
      id: randomUUID(),
      ...(await runImage(request.body?.source, request.body?.image, request.body?.question)),
    };
    const directory = path.join(root, 'runs', report.id);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'report.json');
    const image = path.join(directory, 'input-image');
    const original = report.source === 'upload' ? request.body.image : await demoImage();
    await writeFile(image, Buffer.from(original.data, 'base64'));
    await writeFile(file, JSON.stringify(report, null, 2));
    reports.set(report.id, { file, image, mediaType: report.image.mediaType });
    response.json(report);
  } catch (error) {
    response
      .status(422)
      .json({ error: error instanceof Error ? error.message : 'Image analysis failed.' });
  } finally {
    busy = false;
  }
});
const sources = ['src/image.ts', 'src/agent.ts', 'public/app.js', 'src/server.ts', 'src/cli.ts'];
app.get('/api/source', async (request, response) => {
  const file = String(request.query.file || sources[0]);
  if (!sources.includes(file)) {
    response.status(404).end();
    return;
  }
  response.json({ file, files: sources, content: await readFile(path.join(root, file), 'utf8') });
});
app.get('/api/report/:id', (request, response) => {
  const report = reports.get(String(request.params.id));
  if (!report) {
    response.status(404).end();
    return;
  }
  response.download(report.file, 'image-input-observed-report.json');
});
app.get('/api/image/:id', (request, response) => {
  const report = reports.get(String(request.params.id));
  if (!report) {
    response.status(404).end();
    return;
  }
  response.type(report.mediaType).sendFile(report.image);
});
const port = Number(process.env.PORT || 43134);
app.listen(port, '127.0.0.1', () => console.log(`Prompt 34 lab http://127.0.0.1:${port}`));
