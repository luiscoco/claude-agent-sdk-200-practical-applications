# Prompt 40 · Business validation

Extract actual invoice data through the Claude Agent SDK, validate its structure, and compare its values with independent catalog, order and arithmetic rules before classroom checkout.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43140. Run `npm run agent -- correct` for the CLI. Other modes are wrong-price and wrong-total. Run `npm run typecheck` and `npm test` for offline checks.

## Real structurally valid incorrect results

The supplied classroom invoice is extracted exactly by the real model into the requested schema. Wrong-price mode deliberately supplies SDK-LAB at 900 cents. The authoritative application catalog independently stores 1500 cents for that SKU. The real model output preserves 900 and passes structural validation. Its line arithmetic and 2800-cent subtotal are internally consistent, while the independent catalog check rejects the unit price.

Wrong-total mode supplies the correct item prices and a 4000-cent subtotal, together with a deliberately incorrect 4500-cent total and zero discount. The actual native structured result preserves these supplied integers and passes schema validation. The application recomputes the expected total as 4000 and rejects the 4500 value.

The deliberately incorrect source facts are labelled in the interface and implemented in prepareInvoice. The application preserves the real returned object. suppliedValuesPreserved independently verifies exact extraction of each scenario's classroom input.

## Independent checks after schema validation

InvoiceSchema validates strict objects, integer cent amounts, positive quantities and the EUR/USD currency enum. The application then checks the actual invoice ID and currency, ordered SKUs and quantities, authoritative catalog prices, quantity-times-unit-price line totals, summed subtotal, the 500-cent maximum-discount policy and subtotal-minus-discount total. The independent reference data is displayed beside the native output and saved in every report.

validateBusiness returns each actual and expected value, its path and pass status. The raw model output and its schema result remain visible when a business rule fails. Checkout is withheld until native success, runtime schema validation and every independent business check have passed. consumeInvoice then formats the actual approved amount.

## Repair and evidence

Restore authoritative amounts and run a fresh real query. The valid invoice contains two SDK-LAB items at 1500 cents each and one VIDEO-LAB at 1000 cents, totaling 4000 cents with zero discount. Both validation stages pass and classroom checkout produces EUR 40.00.

Download the actual schema, supplied source, authoritative reference, native result, structural validation status, individual business checks and approved output. Unit checks cover both structurally valid incorrect scenarios, excessive discount and an unknown SKU. Browser demonstrations use real SDK runs, verify checkout withholding and recovery, and check downloads and mobile width.

Each query has a 90-second abort timeout, four agent-loop turns and a USD 0.50 SDK budget limit. Built-in tools, MCP servers and filesystem settings sources are empty. finally clears the timeout and closes the query. The server accepts one experiment at a time and stores observed reports under runs.

## Exercise

Change an authoritative catalog price or the discount policy, then run a new real invoice extraction. Inspect schema success alongside failed business checks. Restore the facts and verify the expected cent amounts before enabling checkout.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK structured output](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
- [Zod runtime validation](https://zod.dev/basics)
