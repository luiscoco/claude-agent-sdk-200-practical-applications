import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export type QuestionKind = 'agent-clarification' | 'tool-permission' | 'mcp-elicitation';
const clarificationSchema = z.object({ choice: z.enum(['MCP', 'Hooks']) }).strict();
const permissionSchema = z.object({ approved: z.boolean() }).strict();
const elicitationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept'), format: z.enum(['brief', 'detailed']) }).strict(),
  z.object({ action: z.literal('decline') }).strict(),
  z.object({ action: z.literal('cancel') }).strict(),
]);
export type Answer =
  | z.infer<typeof clarificationSchema>
  | z.infer<typeof permissionSchema>
  | z.infer<typeof elicitationSchema>;
export type Question = {
  id: string;
  kind: QuestionKind;
  payload: Record<string, unknown>;
  status: 'pending' | 'answered' | 'cancelled';
  answer?: Answer;
};

export class ClassroomQuestions {
  readonly history: Question[] = [];
  private pending:
    | {
        question: Question;
        resolve: (answer: Answer) => void;
        reject: (error: Error) => void;
        cleanup: () => void;
      }
    | undefined;
  current() {
    return this.pending?.question ?? null;
  }
  ask(kind: QuestionKind, payload: Record<string, unknown>, signal: AbortSignal): Promise<Answer> {
    if (signal.aborted) return Promise.reject(new Error('The native request was aborted.'));
    if (this.pending)
      return Promise.reject(new Error('Another classroom request is awaiting its answer.'));
    const question: Question = { id: randomUUID(), kind, payload, status: 'pending' };
    this.history.push(question);
    return new Promise((resolve, reject) => {
      const abort = () => {
        if (this.pending?.question.id !== question.id) return;
        question.status = 'cancelled';
        this.pending.cleanup();
        this.pending = undefined;
        reject(new Error('The native request was aborted.'));
      };
      signal.addEventListener('abort', abort, { once: true });
      this.pending = {
        question,
        resolve,
        reject,
        cleanup: () => signal.removeEventListener('abort', abort),
      };
    });
  }
  answer(id: string, value: unknown) {
    const pending = this.pending;
    if (!pending || pending.question.id !== id)
      throw new Error('This classroom request is no longer pending.');
    const { question } = pending;
    const schema =
      question.kind === 'agent-clarification'
        ? clarificationSchema
        : question.kind === 'tool-permission'
          ? permissionSchema
          : elicitationSchema;
    const answer = schema.parse(value);
    question.answer = answer;
    question.status = 'answered';
    pending.cleanup();
    this.pending = undefined;
    pending.resolve(answer);
    return question;
  }
  cancel() {
    const pending = this.pending;
    if (!pending) return;
    pending.question.status = 'cancelled';
    pending.cleanup();
    this.pending = undefined;
    pending.reject(new Error('The classroom run was cancelled.'));
  }
}
