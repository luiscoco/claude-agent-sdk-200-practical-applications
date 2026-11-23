# Prompt 42 · Read a source file and identify relevant sections

Use the real native Read tool to inspect a TypeScript source file, return a grounded summary and identify relevant source line ranges. Compare the actual tool call, returned sections, independently displayed source and source-range checks.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43142. Run `npm run agent -- existing total` for the CLI. Other examples are existing discount and missing total. Run `npm run typecheck` and `npm test` for offline checks.

## Actual Read and source-grounded output

The model receives a fixed requested source path and a question. The query enables the native Read tool and requests structured summary, section name, start/end lines, explanation and readError fields. The actual message loop records Read inputs and matches their native tool results by tool-use ID. It preserves the final structured result after native SDK success.

The source viewer independently loads fixtures/checkout.ts for student inspection. The actual agent separately calls Read on the requested path before summarizing it. Every saved report retains that tool input, matched native result, source lines, structured output and runtime schema result.

The fixture defines validateItem, validateDiscount and calculateTotal. The total question asks about item validation, subtotal calculation, discount checks and the classroom example. The discount question asks about integer/nonnegative discount values, the 500-cent classroom policy and the subtotal condition. Its actual executable classroom example totals 4000 euro cents. The fixture declares EUR units, the system prompt preserves them, and the run verifier rejects unsupported dollar notation in the returned summary or section text.

The query requests a summary of at most 80 words, up to three sections, and section explanations of at most 20 words. Runtime schema bounds also limit summary length, explanation length and section count. The interface keeps the actual summary and sections scrollable beside the source.

## Returned line ranges

The runtime schema validates the returned section structure. The independent range check verifies each start/end range against the actual source line count, requires ordered bounds and requires a named section to include the relevant function declaration. The source viewer initially highlights a returned range that includes that verified declaration. Clicking another returned section highlights its actual range.

The returned section names and explanations remain available alongside the actual source and native Read evidence. The full report preserves the original returned structured object.

## Genuine missing-file error and repair

Missing mode requests fixtures/missing-checkout.ts directly through the real Read tool. That path is deliberately absent. The actual native tool result contains an error, and the model's structured response records a readError with an empty sections array. The interface displays the native tool error and withholds section-range use. The existing classroom reference source remains available in the viewer, while the requested missing path is shown in the controls and actual call evidence.

Restore existing source and run a fresh discount question. The actual Read succeeds, its grounded summary and section ranges pass their checks, and the corresponding source lines are highlighted. Browser verification exercises total and discount questions, real missing-file failure, recovery, actual declaration highlighting, downloads, invalid topic rejection and responsive width.

Each query has a 90-second abort timeout, six agent-loop turns and a USD 0.75 SDK budget limit. Read is the only enabled built-in tool. MCP servers and filesystem setting sources are empty. finally clears the timeout and closes the query. The server accepts one source-reading experiment at a time and saves actual reports under runs.

## Exercise

Change the source and ask a fresh question. Inspect the actual Read input and native result, review the returned summary against the file, and validate section bounds and relevant declarations before using them. Reproduce the missing source error, restore the real path and verify the repaired source answer.

The original infographic and photo cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK TypeScript tools and native messages](https://code.claude.com/docs/en/agent-sdk/typescript)
- [SDK structured output](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
