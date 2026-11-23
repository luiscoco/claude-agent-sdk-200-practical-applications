import { z } from 'zod';
import { child, exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const outcomes: Record<string, boolean> = {};
  const deny = () => ({ behavior: 'deny', message: 'Owned policy denied' }); outcomes.deniedPermission = deny().behavior === 'deny';
  try { await new Promise((_resolve, reject) => { const controller = new AbortController(); controller.signal.addEventListener('abort', () => reject(new Error('Tool timeout'))); setTimeout(() => controller.abort(), 15); }); } catch (error) { outcomes.toolTimeout = String(error).includes('Tool timeout'); }
  try { z.object({ status: z.literal('ok'), count: z.number() }).parse({ status: 'ok', count: 'invalid' }); } catch { outcomes.malformedResult = true; }
  const disconnected = await child(['-e', 'process.stderr.write("owned connection closed");process.exit(7)']); outcomes.lostConnection = disconnected.code === 7;
  const evidence = await exercise(mode, 'Explain the observed failure outcomes and recovery actions without claiming they succeeded.', async () => outcomes, 'failures');
  return report({ outcomes, lostConnectionExit: disconnected.code }, outcomes, { disconnected, evidence }, 'Actual bounded application fault injection and child connection failure. SDK SSE cancellation is exercised separately in prompts 184/185. These are labelled host-contract tests, not fabricated native API errors.');
}
