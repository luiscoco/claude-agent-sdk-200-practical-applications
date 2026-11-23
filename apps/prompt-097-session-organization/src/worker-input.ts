import { z } from 'zod';
import { requestSchema } from './organization.js';
export function organizationRequest(args: string[]) {
  const operation = z.enum(['apply', 'reload']).parse(args[0]);
  const directory = z.string().min(1).parse(args[1]);
  const input = requestSchema.parse(JSON.parse(args[2] || '{}'));
  return { operation, directory, input };
}
