# Prompt 33 · Tool-call streaming

Display actual tool-call progress and incoming argument fragments while keeping incomplete JSON as preview data.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43133. Run `npm run agent` for the normal live query or `npm run agent -- truncated-preview` for the deliberate application preview error. Run `npm run typecheck` and `npm test` for the offline checks.

## Real Write operation and argument preview

Each run creates a fresh classroom directory under runs and requests a real SDK Write operation to create notes.txt with twenty independently prepared numbered lines. The query enables includePartialMessages and supplies only the Write tool. Permission logic permits the exact fresh notes path and a bounded text content value. The native PreToolUse hook records the SDK's completed structured input, and PostToolUse preserves its actual result.

The preview tracks the API message ID and tool content-block index. content_block_start identifies the tool name and tool-use ID. input_json_delta fragments extend the raw argument buffer. During receiving, the preview's arguments value remains null. append performs string accumulation.

The matching content_block_stop event calls complete, which parses the finished buffer and checks that it is an object. The parsed preview is compared with the native structured tool input using the actual tool-use ID. A message_stop that arrives while the tool block is open marks it incomplete. Query cleanup also marks any remaining open preview incomplete. The preview keeps incomplete blocks unparsed.

The SDK owns tool execution from its completed structured input. The preview supplies progress and validation observations. Its fragment buffer is never passed to an execution function. The server streams the actual preview observations to the browser over a local SSE response.

After the query, the application reads the actual notes file and compares its full content with the independently prepared twenty lines. Verification requires a successful real SDK result, the WRITTEN answer, actual tool completion, multiple observed fragment events, and the expected preview outcome. The live CLI normal run observed 61 fragment events, and the browser normal run observed 60. Counts vary by run and include empty fragment events.

## Deliberate preview error and repair

Truncated-preview mode intentionally removes the final character from the completed buffer's parse source. It preserves the original actual fragments and raises JSON_PREVIEW_ERROR in the preview parser. The SDK still executes its completed native Write input, and the actual file is independently verified. The UI identifies the application preview error and preserves the successful native operation.

Restore the complete preview mode and run a fresh real query. The finished buffer parses successfully, matches the native input, and accompanies the correctly written file. The downloadable report retains raw fragments, block states, native input and result observations, file content, and verification outcomes.

Each query has a 120-second abort timeout, a four-turn agent-loop limit, and a USD 0.70 SDK budget limit. MCP servers and filesystem setting sources are empty. The finally block clears the timer, marks open previews incomplete, and closes the query. The server runs one experiment at a time and aborts a disconnected browser's active query.

## Exercise

Change the prepared line count in source, run a new query, and inspect its actual argument fragments. Verify that arguments remain null while receiving and that the completed preview matches the native input. Compare the actual file with the new expected content. Run the cut-stream unit test and reproduce the deliberate truncation error before restoring the complete preview.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK tool-call streaming and cut-stream behavior](https://code.claude.com/docs/en/agent-sdk/streaming-output)
- [TypeScript hooks and tool permissions](https://code.claude.com/docs/en/agent-sdk/typescript)
