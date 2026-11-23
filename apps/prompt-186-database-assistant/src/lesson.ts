import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { readOnlyQuery } from './database.js';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const file = path.join(process.env.LAB_WORKSPACE!, 'tickets.sqlite'); const writer = new DatabaseSync(file);
  writer.exec("CREATE TABLE tickets(id INTEGER PRIMARY KEY,status TEXT); INSERT INTO tickets VALUES(1,'open'),(2,'closed')"); writer.close();
  const reader = new DatabaseSync(file, { readOnly: true });
  try {
    const failures: string[] = []; for (const [role, sql] of [['guest', 'select id, status from tickets order by id'], ['analyst', 'DELETE FROM tickets'], ['analyst', 'select id, status from tickets order by id; DROP TABLE tickets']]) { try { readOnlyQuery(reader, role, sql); } catch { failures.push(sql); } }
    let engineDenied = false; try { reader.exec('DELETE FROM tickets'); } catch { engineDenied = true; }
    const evidence = await exercise(mode, 'List the open ticket IDs using the authorized database tool.', async sql => readOnlyQuery(reader, 'analyst', sql), "select id, status from tickets where status = 'open' order by id");
    return report(evidence.local, { authorizationAndGrammar: failures.length === 3, databaseReadOnly: engineDenied, structuredRowsCorrect: evidence.local.length === 1 && evidence.local[0].id === 1 }, evidence, 'Actual SQLite read-only connection plus a finite authorized query grammar. Uses Node.js 24 node:sqlite. No unrestricted model-generated SQL is executed.');
  } finally { reader.close(); }
}
