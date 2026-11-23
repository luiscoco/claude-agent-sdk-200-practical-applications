import { AuthorizedTool } from './contracts.js';
import { exercise } from './exercise.js';
import { report } from './native.js';
export async function run(mode: string) {
  const handler = new AuthorizedTool(), failures: string[] = [];
  for (const [label, operation] of [['validation', () => handler.execute('operator', { key: 'a', quantity: -1 })], ['authorization', () => handler.execute('guest', { key: 'a', quantity: 1 })], ['serviceFailure', () => handler.execute('operator', { key: 'a', quantity: 1 }, true)]] as const) { try { operation(); } catch { failures.push(label); } }
  const first = handler.execute('operator', { key: 'a', quantity: 2 }), again = handler.execute('operator', { key: 'a', quantity: 2 });
  let conflict = false; try { handler.execute('operator', { key: 'a', quantity: 3 }); } catch { conflict = true; }
  const evidence = await exercise(mode, 'Invoke the validated classroom operation and report its receipt.', async input => handler.execute('operator', JSON.parse(input)), JSON.stringify({ key: 'live-or-local', quantity: 1 }));
  return report({ failures, first, again, conflict, executions: handler.executions }, { validationAuthorizationFailure: failures.length === 3, repeatedRequestReturnsSameReceipt: first.receipt === again.receipt, conflictingReuseDenied: conflict, independentContractTests: first.quantity === 2 }, evidence, 'The same tool handler is tested independently of the model and exposed through an actual MCP tool in live mode. Receipt mutation is confined to an owned in-memory fixture.');
}
