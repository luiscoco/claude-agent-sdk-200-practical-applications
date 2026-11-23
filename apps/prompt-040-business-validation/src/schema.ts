import { z } from 'zod';
export const InvoiceSchema = z.strictObject({
  invoiceId: z.string().min(1),
  currency: z.enum(['EUR', 'USD']),
  items: z
    .array(
      z.strictObject({
        sku: z.string().min(1),
        quantity: z.number().int().min(1),
        unitPriceCents: z.number().int().min(0),
        lineTotalCents: z.number().int().min(0),
      }),
    )
    .min(1),
  subtotalCents: z.number().int().min(0),
  discountCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
});
export type Invoice = z.infer<typeof InvoiceSchema>;
export const jsonSchema = z.toJSONSchema(InvoiceSchema, { target: 'draft-7' });
