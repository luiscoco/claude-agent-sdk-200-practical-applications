# Prompt 24 · Completion handling

Distinguish actual successful completion, SDK error results, and thrown exceptions, then return a consistent application response for each path.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, configure your Anthropic API key locally, then run `npm start`. Open http://127.0.0.1:43124.

Run `npm run agent -- success`, `result-error`, `turn-limit`, or `exception` for CLI experiments. The CLI returns exit status 1 when the normalized outcome has ok false.

## Actual SDK outcomes

The successful mode asks a real tool-free SDK query for a short completion response. The model's exact answer is preserved.

The unavailable-model mode selects a deliberately absent classroom identifier. In the recorded SDK, its native result has subtype success with is_error true. The application checks both fields and classifies that actual outcome as sdk-result-error.

The one-turn mode asks the agent to Read fixtures/number.txt and then report a calculation. A one-turn cap produces the actual error_max_turns result. The native error list is preserved in the report and normalized message.

The exception mode supplies the same primary and fallback identifier directly to query. The installed SDK constructor throws its actual duplicate-fallback Error before a query is created. The catch block normalizes its name and message. Query.close() is called in finally whenever a query was created. The report records that call explicitly.

src/outcome.ts returns the same fields for every completion path. These include ok, category, message, answer, resultSubtype, resultIsError, and exceptionName. Nullable fields remain present in serialized JSON. The source checks the native SDK discriminants before accessing success text or error arrays. The full actual result remains in the downloadable report.

After receiving its first result, this one-shot handler normalizes that result and leaves the iterator. Its finally block closes any created query. Exceptions thrown before a result use the exception path.

Each SDK query applies a USD 0.20 SDK budget and a 120-second application timeout. Built-in tools are disabled for the tool-free modes. The turn-limit experiment enables Read for its classroom fixture.

Run `npm test` to check normalization against recorded native success and error-result snapshots under fixtures/results. The regression includes a success subtype carrying is_error true and verifies consistent response keys. Run `npm run typecheck` to check the installed SDK declarations.

For practice, compare all four outcomes, inspect nullable fields, and branch on ok and category from a small caller. Verify that the unavailable-model error text and constructor exception message remain available after normalization. Restore the successful query and download its fresh report.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [SDK result types and query API](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Turn limits and the execution loop](https://code.claude.com/docs/en/agent-sdk/agent-loop)
- [SDK startup and process troubleshooting](https://code.claude.com/docs/en/agent-sdk/troubleshooting)
