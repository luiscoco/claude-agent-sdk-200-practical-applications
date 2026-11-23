# Prompt 25 · Input modes

Implement the same addition task with a string prompt and an asynchronous SDKUserMessage generator. Compare the real responses and inspect how each input was submitted.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, configure your Anthropic API key locally, then run `npm start`. Open http://127.0.0.1:43125.

Run `npm run agent -- string`, `streaming`, or `generator-error` for the CLI examples using 12 and 30. A failed SDK run returns CLI exit status 1.

## Experiments

The server prepares one arithmetic prompt and independently computes the safe-integer sum. String mode passes that string directly as prompt. Streaming mode passes the asynchronous generator from src/input.ts, which yields a documented user message containing exactly the same text. The report records the actual yielded message before it is submitted.

Both modes consume SDK output through the same asynchronous result loop. The comparison action starts two independent real queries in sequence and displays both actual answers. The application verifies each integer answer against the independent expected sum. Each query disables built-in tools, MCP, and filesystem settings and uses a one-turn limit, USD 0.10 SDK budget limit, and 120-second application timeout.

String input fits a one-shot task. A user-message generator provides the input structure used for sessions that receive additional messages or richer content over time. This lesson submits one message per query in both modes. The following conversation lessons extend streaming input across multiple user turns.

The generator-error experiment deliberately throws inside the actual input generator before yielding a message. Its input event records the original classroom diagnostic. The installed SDK then reports Operation aborted. The report preserves both observations. Restore streaming input to repair the deliberate failure and run another real query.

Use safe integers as operands. The server rejects invalid numbers and sums outside JavaScript's safe-integer range before creating a query. SDK and generator errors remain visible in the downloaded report. A successful verification requires a real result, a numeric response, and the expected arithmetic value.

Run `npm test` for task preparation, yielded user-message content, generator failure capture, and numeric validation. Run `npm run typecheck` to check the installed SDK declarations.

For practice, compare both modes with a different pair of integers and inspect their actual input values, SDK frames, and answers. Trace a generator failure to its original diagnostic, restore the valid generator, and verify the repaired run.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [String and streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [TypeScript SDK query and user-message types](https://code.claude.com/docs/en/agent-sdk/typescript)
