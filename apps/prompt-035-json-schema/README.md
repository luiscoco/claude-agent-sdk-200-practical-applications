# Prompt 35 · JSON Schema

Return a structured SDK result using outputFormat and a small JSON Schema, then verify its values against supplied workshop facts.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43135. Run `npm run agent -- valid basics`, `npm run agent -- valid streaming`, or `npm run agent -- invalid-schema` for the CLI scenarios. Run `npm run typecheck` and `npm test` for the offline checks.

## Native structured result

The draft-07 workshop schema declares an object containing a title string, an integer durationMinutes, an ordered string-array prerequisites field, and a published boolean. All four fields are required, duration is bounded from 1 to 120, and additional properties are disabled.

The query passes outputFormat with type json_schema and the actual selected schema. It extracts facts from the prepared classroom source text. On a successful result, the application reads message.structured_output. The unstructured result text is preserved separately. SDK result-type narrowing precedes access to the structured output field.

The application independently prepares the expected workshop values from its supplied facts and compares the complete returned object with that expectation. The real Basics run returned duration 25 and published false. The real Streaming run returns duration 40 and published true, with its own prerequisite order. JSON values retain their number, array, string, and boolean types.

The report preserves the actual schema, supplied text, structured output, final result text, SDK message types, native session ID, and observed tool names. The recorded runtime used its internally managed StructuredOutput tool. The SDK's output-format configuration controls that structured-result flow. The application-specified built-in tool list, MCP servers, and filesystem setting sources are empty.

## Native malformed-schema failure and recovery

The deliberate malformed schema replaces required's string array with the string title. The native runtime rejects it at startup with the diagnostic `--json-schema is not a valid JSON Schema: data/required must be array`. The report preserves the actual SDK exception and stderr, zero structured output, and the failed native run. The UI displays the relevant schema error line. The full runtime diagnostic also contains the environment's authentication-precedence notice.

Restore the required array and run a fresh real extraction. The native structured object again matches the independently supplied workshop facts. The scenario verifier recognizes the specific native required-field diagnostic for the deliberate schema error. Other failures remain unverified.

Each query has a 90-second abort timeout, a four-turn agent-loop limit, and a USD 0.50 SDK budget limit. The finally block clears the timer and closes the query. The server runs one experiment at a time, saves reports locally under runs, and supports report download.

## Exercise

Change a supplied workshop fact in source and inspect its matching expected value. Run the extraction and verify the actual structured object. Compare published false and true, preserve prerequisite order, and reproduce the malformed required declaration before restoring the valid schema.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK structured-output configuration and result field](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
- [TypeScript query and result types](https://code.claude.com/docs/en/agent-sdk/typescript)
