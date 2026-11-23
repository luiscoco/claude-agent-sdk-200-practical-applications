import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const projectId = z.enum(['alice-lab', 'bob-lab']);
export const toolInputShape = { projectId };
export const toolInputSchema = z.object(toolInputShape).strict();
export const requestSchema = z
  .object({ actor: z.enum(['alice', 'bob', 'instructor']), projectId })
  .strict();
export const outcomeSchema = z
  .object({
    ok: z.boolean(),
    actorId: z.string(),
    projectId,
    notes: z.array(z.string()).nullable(),
    errorCode: z.enum(['', 'FORBIDDEN']),
    message: z.string(),
  })
  .strict();
export const principals = {
  alice: { id: 'alice', role: 'learner' as const },
  bob: { id: 'bob', role: 'learner' as const },
  instructor: { id: 'instructor', role: 'instructor' as const },
};
export type Principal = { readonly id: string; readonly role: 'learner' | 'instructor' };
const owners = { 'alice-lab': 'alice', 'bob-lab': 'bob' };
const protectedNotes = {
  'alice-lab': ['ALICE_CLASSROOM_NOTE · Synthetic project note for the authorization lesson.'],
  'bob-lab': ['BOB_CLASSROOM_NOTE · Synthetic project note for the authorization lesson.'],
};
export type AccessEvent = { projectId: z.infer<typeof projectId>; actorId: string };
export function readAuthorizedNotes(
  principal: Principal,
  requestedProject: z.infer<typeof projectId>,
  accesses: AccessEvent[],
): z.infer<typeof outcomeSchema> {
  const allowed = principal.role === 'instructor' || owners[requestedProject] === principal.id;
  if (!allowed) {
    return {
      ok: false,
      actorId: principal.id,
      projectId: requestedProject,
      notes: null,
      errorCode: 'FORBIDDEN',
      message:
        'This classroom identity cannot read the requested project. Select a project assigned to this identity.',
    };
  }
  accesses.push({ projectId: requestedProject, actorId: principal.id });
  const notes = [...protectedNotes[requestedProject]];
  return {
    ok: true,
    actorId: principal.id,
    projectId: requestedProject,
    notes,
    errorCode: '',
    message: 'Authorized classroom project notes retrieved.',
  };
}
export type Execution = {
  input: z.infer<typeof toolInputSchema>;
  actorId: string;
  role: Principal['role'];
  decision: 'allow' | 'deny';
  protectedReadsBefore: number;
  protectedReadsAfter: number;
  outcome: z.infer<typeof outcomeSchema>;
  processId: number;
};
export function createAuthorizationServer(
  principal: Principal,
  executions: Execution[],
  accesses: AccessEvent[],
) {
  const readNotes = tool(
    'read_project_notes',
    'Read synthetic classroom project notes. The handler enforces the host-selected principal and project ownership or instructor role. Preserve the actual authorization outcome.',
    toolInputShape,
    async (args) => {
      const input = toolInputSchema.parse(args);
      const protectedReadsBefore = accesses.length;
      const outcome = readAuthorizedNotes(principal, input.projectId, accesses);
      executions.push({
        input,
        actorId: principal.id,
        role: principal.role,
        decision: outcome.ok ? 'allow' : 'deny',
        protectedReadsBefore,
        protectedReadsAfter: accesses.length,
        outcome,
        processId: process.pid,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
        isError: !outcome.ok,
      };
    },
    {
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  );
  return createSdkMcpServer({ name: 'projects', version: '1.0.0', tools: [readNotes] });
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
