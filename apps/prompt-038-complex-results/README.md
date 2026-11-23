# Prompt 38 · Complex structured results

Run a real Claude Agent SDK query that returns a nested course plan with an owner object, an ordered lesson array, enum values and optional fields. Validate the actual object with Zod before the typed application consumer calculates its two-lesson, 35-minute summary.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43138. Run `npm run agent -- with-optionals` for the CLI. Run `npm run typecheck` and `npm test` for offline checks. The SDK, Zod and development dependencies are pinned in package-lock.json.

## Nested schema and real output

CoursePlanSchema defines a nonempty title, a beginner/intermediate audience enum, a nested owner with required name and optional timezone, a nonempty array of lessons, and optional notes. Every lesson has a title, bounded integer minutes and an array of code/demo/exercise enum tags. Strict objects reject extra properties. z.toJSONSchema converts this definition to draft-07 for outputFormat.

With-optionals mode supplies the timezone and notes facts. Without-optionals mode leaves both facts out of the prompt. The native SDK output actually omits these two fields, which remain optional in the schema and runtime validation. The consumer supplies interface display fallbacks with nullish coalescing. Its presence flags still report the original absence. Tests also verify that null is rejected for these optional string fields.

The typed consumer uses validated owner data, counts the ordered lesson array and sums its numeric minute values. Both valid modes produce two lessons and a 35-minute total. The real native object is compared with the independently prepared facts, including lesson and tag order.

## Deliberate boundary failures and repair

Missing-name mode runs a real valid query, preserves its returned object and removes owner.name from a copied application-boundary candidate. Zod produces its actual nested issue path and withholds typed application use. Invalid-enum mode similarly changes the copied audience to expert. Its actual validation issue is preserved while the raw native audience remains intermediate. These classroom transformations are implemented in boundaryCandidate and labelled in the interface.

Restore supplied nested data and run a fresh query to validate and consume the actual result. Each report includes the schema, source facts, raw native output, copied candidate, parsed data, actual issues, typed result and scenario verification. Download the observed report from the interface.

Each query has a 90-second timeout, four agent-loop turns and a USD 0.50 budget limit. Built-in tools, MCP servers and filesystem settings sources are empty. The server permits one experiment at a time, and finally closes the query and clears its timer. Native reports are stored under runs.

## Exercise

Add a field inside each lesson, regenerate the schema, and validate a real result. Compare absent optional fields with their application display values. Reproduce the missing nested owner name and invalid audience, inspect each issue path, then restore valid data before the typed consumer runs.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK structured outputs](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
- [Zod JSON Schema conversion](https://zod.dev/json-schema)
- [Zod optional fields, enums and arrays](https://zod.dev/api)
