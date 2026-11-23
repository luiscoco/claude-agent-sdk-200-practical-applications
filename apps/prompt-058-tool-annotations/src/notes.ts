import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';

const noteValue = z.string().min(1).max(120);
export const requestSchema = z
  .object({
    mode: z.enum(['read', 'write-repeat', 'delete']),
    value: noteValue,
    confirmDelete: z.boolean(),
  })
  .strict();
export const stateSchema = z
  .object({ note: z.string().nullable(), revision: z.number().int().nonnegative() })
  .strict();
export const outcomeSchema = z
  .object({
    ok: z.boolean(),
    operation: z.enum(['read', 'write', 'delete']),
    note: z.string().nullable(),
    revision: z.number().int(),
    changed: z.boolean(),
    errorCode: z.enum(['', 'DELETE_CONFIRMATION_REQUIRED']),
  })
  .strict();
export const toolAnnotations = {
  read_note: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  set_note: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  delete_note: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
};
type Operation = 'read' | 'write' | 'delete';
type Snapshot = z.infer<typeof stateSchema>;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function createNoteStore(file: string) {
  let pending = Promise.resolve();
  return function operate(operation: Operation, value?: string) {
    const result = pending.then(async () => {
      const beforeText = await readFile(file, 'utf8');
      const before = stateSchema.parse(JSON.parse(beforeText));
      let note = before.note;
      if (operation === 'write') note = noteValue.parse(value);
      if (operation === 'delete') note = null;
      const changed = note !== before.note;
      const after: Snapshot = { note, revision: before.revision + Number(changed) };
      let afterText = beforeText;
      if (changed) {
        afterText = JSON.stringify(after, null, 2) + '\n';
        const temporary = file + '.' + randomUUID() + '.tmp';
        try {
          await writeFile(temporary, afterText, 'utf8');
          await rename(temporary, file);
        } finally {
          await rm(temporary, { force: true });
        }
      }
      return {
        before,
        after,
        changed,
        beforeSha256: digest(beforeText),
        afterSha256: digest(afterText),
      };
    });
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
export type Execution = {
  name: string;
  input: unknown;
  outcome: z.infer<typeof outcomeSchema>;
  beforeSha256: string;
  afterSha256: string;
  processId: number;
};

export function createNoteServer(file: string, confirmed: boolean, executions: Execution[]) {
  const operate = createNoteStore(file);
  async function invoke(operation: Operation, input: unknown, value?: string) {
    const denied = operation === 'delete' && !confirmed;
    const observed = await operate(denied ? 'read' : operation, value);
    const outcome = {
      ok: !denied,
      operation,
      ...observed.after,
      changed: observed.changed,
      errorCode: denied ? ('DELETE_CONFIRMATION_REQUIRED' as const) : ('' as const),
    };
    const names = { read: 'read_note', write: 'set_note', delete: 'delete_note' };
    executions.push({
      name: 'mcp__notes__' + names[operation],
      input,
      outcome,
      beforeSha256: observed.beforeSha256,
      afterSha256: observed.afterSha256,
      processId: process.pid,
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(outcome) }],
      structuredContent: outcome,
      isError: denied,
    };
  }
  const readNote = tool(
    'read_note',
    'Read the current local classroom note without changing its state.',
    {},
    async (args) => invoke('read', args),
    { annotations: toolAnnotations.read_note },
  );
  const setNote = tool(
    'set_note',
    'Replace the local classroom note with the supplied value. Repeating the same value preserves the state and revision.',
    { value: noteValue },
    async (args) => invoke('write', args, args.value),
    { annotations: toolAnnotations.set_note },
  );
  const deleteNote = tool(
    'delete_note',
    'Delete the local classroom note when the host has confirmed deletion. The handler enforces host confirmation. Repeated confirmed deletion preserves the resulting state.',
    {},
    async (args) => invoke('delete', args),
    { annotations: toolAnnotations.delete_note },
  );
  return createSdkMcpServer({
    name: 'notes',
    version: '1.0.0',
    tools: [readNote, setNote, deleteNote],
  });
}

export async function inspectProtocolAnnotations(file: string) {
  const server = createNoteServer(file, false, []);
  const client = new Client({ name: 'classroom-annotation-inspector', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.instance.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    return listed.tools.map((tool) => ({ name: tool.name, annotations: tool.annotations }));
  } finally {
    await client.close();
    await server.instance.close();
  }
}

export function nativeOutcome(content: unknown) {
  let text = '';
  if (typeof content === 'string') text = content;
  if (Array.isArray(content))
    text = content
      .filter((block) => block?.type === 'text')
      .map((block) => block.text)
      .join('\n');
  try {
    const parsed = outcomeSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
