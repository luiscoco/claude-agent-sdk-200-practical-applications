import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const inputShape = { pack: z.enum(['available', 'missing']) };
export const requestSchema = z.object(inputShape).strict();
export const outcomeSchema = z
  .object({
    ok: z.boolean(),
    lessonNumber: z.number().int().nullable(),
    title: z.string(),
    sectionCount: z.number().int(),
    resourceSha256: z.string(),
    resourceUri: z.string(),
    errorCode: z.enum(['', 'PACK_NOT_FOUND']),
  })
  .strict();
export const resourceUri = 'course://lessons/56/outline';
export const fixtureSchema = z
  .object({ lessonNumber: z.literal(56), title: z.string(), sections: z.array(z.string()) })
  .strict();
export const digest = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
export type Execution = {
  input: { pack: 'available' | 'missing' };
  outcome: z.infer<typeof outcomeSchema>;
  contentTypes: string[];
  resource: unknown;
  processId: number;
};

export function createPackServer(executions: Execution[]) {
  const root = path.resolve(import.meta.dirname, '..');
  const getPack = tool(
    'get_lesson_pack',
    'Read the local classroom lesson pack and return its summary text, an embedded JSON outline resource and machine-readable structured data. Preserve missing-pack errors.',
    inputShape,
    async (args) => {
      const input = requestSchema.parse(args);
      let document;
      try {
        const name = input.pack === 'missing' ? 'missing-lesson-pack.json' : 'lesson-pack.json';
        document = fixtureSchema.parse(
          JSON.parse(await readFile(path.join(root, 'fixtures', name), 'utf8')),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const outcome = {
          ok: false,
          lessonNumber: null,
          title: '',
          sectionCount: 0,
          resourceSha256: '',
          resourceUri: '',
          errorCode: 'PACK_NOT_FOUND' as const,
        };
        executions.push({
          input,
          outcome,
          contentTypes: ['text'],
          resource: null,
          processId: process.pid,
        });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(outcome) }],
          structuredContent: outcome,
          isError: true,
        };
      }
      const resource = {
        uri: resourceUri,
        mimeType: 'application/json',
        text: JSON.stringify(document),
      };
      const outcome = {
        ok: true,
        lessonNumber: document.lessonNumber,
        title: document.title,
        sectionCount: document.sections.length,
        resourceSha256: digest(resource.text),
        resourceUri,
        errorCode: '' as const,
      };
      executions.push({
        input,
        outcome,
        contentTypes: ['text', 'resource'],
        resource,
        processId: process.pid,
      });
      const content = [
        { type: 'text' as const, text: JSON.stringify(outcome) },
        { type: 'resource' as const, resource },
      ];
      return { content, structuredContent: outcome };
    },
    { annotations: { readOnlyHint: true, destructiveHint: false } },
  );
  return createSdkMcpServer({ name: 'lessons', version: '1.0.0', tools: [getPack] });
}

export function nativeTexts(content: unknown): string[] {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text);
}

export function nativeOutcome(content: unknown) {
  for (const text of nativeTexts(content)) {
    try {
      const parsed = outcomeSchema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {}
  }
  return null;
}

export function nativeResource(content: unknown) {
  const prefix = '[Resource from lessons at ' + resourceUri + '] ';
  const observed = nativeTexts(content).find((text) => text.startsWith(prefix));
  if (!observed) return null;
  const text = observed.slice(prefix.length);
  try {
    const document = fixtureSchema.parse(JSON.parse(text));
    return { uri: resourceUri, text, document, sha256: digest(text) };
  } catch {
    return null;
  }
}
