import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export type QuestionKind = 'tool-permission';
export const answerSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('allow') }).strict(),
  z.object({ action: z.literal('deny') }).strict(),
  z.object({ action: z.literal('revise'), content: z.string().min(1).max(2000) }).strict(),
]);
export type Answer = z.infer<typeof answerSchema>;
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
    const answer = answerSchema.parse(value);
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
