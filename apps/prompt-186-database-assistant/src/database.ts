import { DatabaseSync } from 'node:sqlite';
export function readOnlyQuery(db: DatabaseSync, role: string, sql: string) {
  if (role !== 'analyst') throw new Error('Not authorized.');
  // Deliberately finite classroom query grammar, not a general SQL sanitizer.
  const normalized = sql.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!['select id, status from tickets order by id', "select id, status from tickets where status = 'open' order by id"].includes(normalized)) throw new Error('Query is outside the approved read-only grammar.');
  return db.prepare(normalized).all();
}
