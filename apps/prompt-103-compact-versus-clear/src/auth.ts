import { mkdir, copyFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
/** Reuse the user's existing native login without exposing it in reports. */
export async function prepareAuth(config: string) {
  await mkdir(config, { recursive: true });
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN) return;
  try { await copyFile(path.join(os.homedir(), '.claude', '.credentials.json'), path.join(config, '.credentials.json')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
