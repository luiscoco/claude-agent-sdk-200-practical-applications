import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const classroomUsers = {
  'learner-a': 'Classroom Learner A',
  'learner-b': 'Classroom Learner B',
} as const;
export type UserId = keyof typeof classroomUsers;
export type ClassroomSession = {
  id: string;
  userId: UserId;
  displayName: string;
  expiresAt: number;
};
export type JobOwner = { userId: UserId; sessionId: string; displayName: string };
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export class ClassroomSessions {
  private sessions = new Map<string, ClassroomSession>();
  create(userId: UserId) {
    const token = randomBytes(32).toString('base64url');
    const session: ClassroomSession = {
      id: randomUUID(),
      userId,
      displayName: classroomUsers[userId],
      expiresAt: Date.now() + 3600000,
    };
    this.sessions.set(tokenHash(token), session);
    return { token, session };
  }
  get(token: string | undefined) {
    if (!token) return null;
    const key = tokenHash(token),
      session = this.sessions.get(key);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }
  revoke(token: string | undefined) {
    if (!token) return null;
    const key = tokenHash(token),
      session = this.sessions.get(key) ?? null;
    this.sessions.delete(key);
    return session;
  }
}
export function ownsJob(owner: JobOwner, session: ClassroomSession) {
  return owner.userId === session.userId && owner.sessionId === session.id;
}
export function cookieToken(cookie: string | undefined) {
  return cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('classroom_session='))
    ?.slice('classroom_session='.length);
}
