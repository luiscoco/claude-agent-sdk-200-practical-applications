import path from 'node:path';
import { load, save } from './application.js';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const file = path.join(process.env.LAB_WORKSPACE!, 'outbox.json'), ticket = { id: 'T189', customer: 'Customer A', purchasedDaysAgo: 12, policy: 'Refund requests within 30 days are eligible for review. Never promise settlement before approval.' };
  const evidence = await exercise(mode, 'Draft a support reply for this ticket based only on policy. This is a draft; do not send anything.', async () => ticket, 'T189');
  const draft = mode === 'live' ? evidence.observed.events.findLast(e => e.type === 'result')?.result : 'Your purchase is within the 30-day review window. Your refund request can be reviewed; settlement requires approval.';
  async function submit(approved: boolean) { if (!approved) throw new Error('Explicit approval required.'); const outbox = await load<any[]>(file, []); if (!outbox.some(item => item.id === ticket.id)) await save(file, [...outbox, { id: ticket.id, draft, destination: 'owned classroom outbox only' }]); }
  let blocked = false; try { await submit(false); } catch { blocked = true; } const before = await load<any[]>(file, []);
  await submit(true); await submit(true); const after = await load<any[]>(file, []);
  return report({ ticket, draft, classroomApprovalFixture: true, before, after, externalMessagesSent: 0 }, { noActionBeforeApproval: blocked && before.length === 0, approvedOwnedOutboxOnly: after.length === 1, duplicatePrevented: after[0].id === ticket.id, draftExists: typeof draft === 'string' && draft.length > 20 }, evidence, 'Local approval fixtures exercise a real gate and idempotent owned outbox. No customer is contacted. Live mode generates a real draft; external dispatch requires a separately authorized integration.');
}
