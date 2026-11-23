import 'dotenv/config';
import express from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launch } from './launch.js';
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(path.join(root, 'lab.json'), 'utf8'));
const app = express();
let busy = false;
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'");
  if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
    res.status(403).json({ error: 'Unexpected request origin.' }); return;
  }
  next();
});
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(root, 'public')));
app.get('/api/lab', (_req, res) => res.json(manifest));
app.get('/api/source', async (req, res) => {
  const file = String(req.query.file || 'src/lesson.ts');
  if (!manifest.sources.includes(file)) { res.status(404).end(); return; }
  res.json({ file, files: manifest.sources, content: await readFile(path.join(root, file), 'utf8') });
});
app.post('/api/run', async (req, res) => {
  if (!req.body || Object.keys(req.body).join(',') !== 'mode' || !manifest.modes.some((m: any) => m.id === req.body.mode)) {
    res.status(422).json({ error: 'Choose one of this lesson’s supported experiments.' }); return;
  }
  if (busy) { res.status(409).json({ error: 'An experiment is already running.' }); return; }
  busy = true;
  try { res.json(await launch(req.body.mode)); }
  catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : String(error) }); }
  finally { busy = false; }
});
const port = Number(process.env.PORT || manifest.port);
app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Prompt ${manifest.number}: http://127.0.0.1:${port}`));
