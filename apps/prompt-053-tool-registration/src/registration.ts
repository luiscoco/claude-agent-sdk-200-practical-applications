import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const requestSchema = z
  .object({
    sku: z.enum(['MIC-101', 'CAB-202']),
    registration: z.enum(['complete', 'missing-warehouse']),
  })
  .strict();
export const lookupShape = { sku: z.enum(['MIC-101', 'CAB-202']) };
const lookupInput = z.object(lookupShape).strict();
const catalogSchema = z
  .object({ sku: lookupShape.sku, name: z.string(), priceCents: z.number().int() })
  .strict();
const warehouseSchema = z
  .object({ sku: lookupShape.sku, available: z.number().int(), location: z.string() })
  .strict();
export const outputSchema = z
  .object({
    catalog: catalogSchema.nullable(),
    warehouse: warehouseSchema.nullable(),
    missingTools: z.array(z.string()),
  })
  .strict();

export const expectedNames = ['mcp__catalog__lookup', 'mcp__warehouse__lookup'];
const catalog = {
  'MIC-101': { sku: 'MIC-101', name: 'Classroom microphone', priceCents: 7900 },
  'CAB-202': { sku: 'CAB-202', name: 'Classroom USB cable', priceCents: 1200 },
};
const warehouse = {
  'MIC-101': { sku: 'MIC-101', available: 12, location: 'Classroom shelf A' },
  'CAB-202': { sku: 'CAB-202', available: 37, location: 'Classroom shelf B' },
};
export type Execution = {
  serverKey: string;
  qualifiedName: string;
  input: { sku: string };
  outcome: unknown;
  processId: number;
};

export function createRegisteredServers(executions: Execution[]) {
  const catalogLookup = tool(
    'lookup',
    'Look up the product name and price in the local classroom catalog.',
    lookupShape,
    async (args) => {
      const input = lookupInput.parse(args);
      const outcome = catalog[input.sku];
      executions.push({
        serverKey: 'catalog',
        qualifiedName: expectedNames[0],
        input,
        outcome,
        processId: process.pid,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
      };
    },
    { annotations: { readOnlyHint: true, destructiveHint: false } },
  );
  const warehouseLookup = tool(
    'lookup',
    'Look up available units and shelf location in the local classroom warehouse.',
    lookupShape,
    async (args) => {
      const input = lookupInput.parse(args);
      const outcome = warehouse[input.sku];
      executions.push({
        serverKey: 'warehouse',
        qualifiedName: expectedNames[1],
        input,
        outcome,
        processId: process.pid,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome) }],
        structuredContent: outcome,
      };
    },
    { annotations: { readOnlyHint: true, destructiveHint: false } },
  );
  const catalogServer = createSdkMcpServer({
    name: 'catalog-service',
    version: '1.0.0',
    tools: [catalogLookup],
  });
  const warehouseServer = createSdkMcpServer({
    name: 'warehouse-service',
    version: '1.0.0',
    tools: [warehouseLookup],
  });
  return { catalogServer, warehouseServer };
}

export function nativeObject(content: unknown) {
  let text = '';
  if (typeof content === 'string') text = content;
  if (Array.isArray(content))
    text = content
      .filter((block) => block?.type === 'text')
      .map((block) => block.text)
      .join('\n');
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
