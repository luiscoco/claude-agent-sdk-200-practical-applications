# Prompt 36 · Zod integration

Define a TypeScript result schema with Zod, generate the SDK's JSON Schema from it, and validate unknown structured output before calling typed application logic.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43136. Run `npm run agent -- valid basics` or `npm run agent -- corrupt-boundary` for the CLI. Run `npm run typecheck` and `npm test` for the offline checks. Zod 4.6.7 is an explicit pinned dependency.

## One result definition

WorkshopSchema is a strict Zod object with a nonempty title, integer duration from 1 to 120, a nonempty array of nonempty prerequisite strings, and a publication boolean. The Workshop TypeScript type is inferred with z.infer.

z.toJSONSchema generates the output schema with target draft-7. The query passes that actual generated object through outputFormat. The SDK returns its real structured_output, which the application preserves as an unknown value. The generated schema is visible in the interface and included in each report.

The application calls WorkshopSchema.safeParse on the runtime-boundary input. After native SDK success and successful validation, it passes parsed.data to consumeWorkshop, whose parameter has the inferred Workshop type. That function adds a five-minute break numerically, joins prerequisite names, and derives a publication label. Its actual output is preserved in the report.

The real Basics result produces a total of 30 minutes including the break. The Streaming result produces 45 minutes. Their native structured objects also match the independently supplied workshop facts.

## Deliberate boundary corruption and repair

Corrupt-boundary mode copies the successful native structured object and intentionally converts durationMinutes to a string. The raw SDK object is preserved. Zod rejects the copied string duration with its actual invalid_type issue at durationMinutes. The typed consumer stays uncalled and its output remains null.

Restore the valid boundary and run a fresh real query. safeParse accepts the numeric value and the typed consumer executes. The browser verification checks raw native facts, the actual rejected candidate, withheld typed use, restored validation, and the repaired 45-minute total. Unit tests also check generated draft-07 schema, the typed application calculation, strict extra-field rejection, and preservation of the original native-shaped data during deliberate corruption.

Each query has a 90-second abort timeout, a four-turn agent-loop limit, and a USD 0.50 SDK budget limit. Built-in tools, MCP servers, and filesystem setting sources are empty. The finally block clears the timer and closes the query. The server accepts one active experiment at a time and stores reports under runs.

## Exercise

Change a Zod field constraint and inspect the generated JSON Schema. Run a new native structured query, inspect safeParse, and trace parsed.data into the typed consumer. Reproduce the deliberately string-valued duration and restore numeric input. Compare the raw native object, validation candidate, actual Zod issues, and application output.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [Zod JSON Schema conversion](https://zod.dev/json-schema)
- [Zod safeParse and inferred types](https://zod.dev/basics)
- [SDK structured outputs with Zod](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
