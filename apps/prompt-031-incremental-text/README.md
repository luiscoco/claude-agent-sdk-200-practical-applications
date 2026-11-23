# Prompt 31 · Incremental text

Enable partial-message output and display actual text deltas as they arrive, then compare their concatenation with the completed text and final result.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43131. Run `npm run agent` to print actual incremental text to stdout, or append `-- complete` or `-- wrong-filter` to select another mode. Run `npm run typecheck` and `npm test` for input validation checks.

## Actual incremental output

The SDK query sets includePartialMessages true for incremental output. The consumer narrows message.type to stream_event, event.type to content_block_delta, and delta.type to text_delta. It preserves every actual text chunk and immediately emits accepted chunks to the display callback. The CLI uses process.stdout.write. The browser receives those actual observations through a local POST response stream and appends render-text events to the output element as they arrive.

The server writes a two-field SSE frame for each observation and a final report frame after SDK iteration ends. The browser uses TextDecoder with streaming enabled, buffers partial frames, and parses complete frames across arbitrary network chunk boundaries. A disconnected client aborts its active SDK query. Reports are saved locally under runs and can be downloaded from the interface.

Completed AssistantMessage text blocks are collected independently. Incremental mode renders only accepted partial chunks. Completed-block mode disables partial messages and renders text when completed assistant blocks arrive. The report compares the rendered string and independently accumulated completed text with the actual final result. Its timing fields show first rendered text, first completed block, and result arrival for that individual query. Separate model queries can produce different wording and timing.

The live browser check observes visible text while the incremental query is still running. It also checks that render-text events precede completed-block events. Completed-block mode produces no observed text deltas in its run. Full actual observations are preserved in each report.

## Deliberate wrong filter and recovery

Wrong-filter mode enables partial messages, then deliberately configures the display filter to accept input_json_delta while observing text_delta events. The actual text deltas and completed answer still arrive. The display remains empty and the application shows its CLASSROOM_FILTER_ERROR diagnostic. This is an application display error. The SDK success and completed text are preserved in the report.

Restore the text_delta filter and run another real query. The accepted chunks render as they arrive and their accumulated text matches the final answer. For practice, change the prompt and compare incremental and completed-block modes again.

Each query has a 90-second abort timeout, a one-turn agent-loop limit, and a USD 0.30 SDK budget limit. Tools, MCP servers, and filesystem setting sources are empty. The finally block clears the timeout and closes the query. The server accepts one active experiment at a time.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [Partial-message text streaming](https://code.claude.com/docs/en/agent-sdk/streaming-output)
- [TypeScript SDK options and message types](https://code.claude.com/docs/en/agent-sdk/typescript)
