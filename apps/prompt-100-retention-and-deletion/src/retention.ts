import { z } from 'zod';
export const requestSchema = z
  .object({
    mode: z.enum(['dry-run', 'delete-expired', 'protect']),
    retentionHours: z.union([z.literal(24), z.literal(72)]),
  })
  .strict();
export function planRetention(
  sessions: Array<{ sessionId: string; lastModified: number }>,
  cutoff: number,
  protectedIds: Set<string>,
  ownedIds: Set<string>,
) {
  return sessions.map((session) => {
    const reason = !ownedIds.has(session.sessionId)
      ? 'outside-owned-catalog'
      : protectedIds.has(session.sessionId)
        ? 'protected'
        : !Number.isFinite(session.lastModified) || session.lastModified <= 0
          ? 'invalid-timestamp'
          : session.lastModified <= cutoff
            ? 'expired'
            : 'recent';
    return {
      sessionId: session.sessionId,
      lastModified: session.lastModified,
      cutoff,
      eligible: reason === 'expired',
      reason,
    };
  });
}
