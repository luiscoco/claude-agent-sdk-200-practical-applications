import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const expectedContent = [
  '# SDK Workshop Report',
  '',
  '## Classroom facts',
  '- Course: Claude Agent SDK',
  '- Duration: 40 minutes',
  '- Lab: Write a report and verify it',
  '',
  '## Run the application',
  '```bash',
  'npm ci',
  'npm start',
  '```',
  '',
  'Verification marker: WRITE-044',
  '',
].join('\n');
export function sha256(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
export async function inspectReport(file: string) {
  try {
    const content = await readFile(file, 'utf8');
    return {
      exists: true,
      content,
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: sha256(content),
      error: '',
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { exists: false, content: null, bytes: null, sha256: null, error: '' };
    return {
      exists: null,
      content: null,
      bytes: null,
      sha256: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
