# Prompt 32 · Duplicate prevention

Render streaming deltas and completed assistant text without displaying the same response twice.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43132. Run `npm run agent -- reconciled`, `npm run agent -- naive`, or `npm run agent -- completed-only` for the CLI. Run `npm run typecheck` and `npm test` for the offline checks.

## Block identities and reconciliation

Each real query requests the same explicitly prepared three-line response. All rendering modes enable includePartialMessages and receive actual partial events and completed assistant messages. The consumer reads the API message ID from message_start and tracks text blocks by that ID and the content-block index. The SDK's completed assistant message carries the same API message ID.

The renderer preserves the ordered text blocks within each message. Actual text deltas extend the corresponding block's streamed text and incremental display. When the completed assistant text arrives, reconciled mode replaces that existing block's display with its complete text. This also repairs a partial display that was missing a suffix. The renderer emits its current visible snapshot to the browser, which replaces the displayed string.

The pinned SDK emits each completed assistant content block before its content_block_stop event. Completed text is associated with the next unfinished text block for that API message ID, following that ordered delivery. A completed event ID, built from the SDK message UUID and content position, suppresses repeated delivery of the same completion. Completed text that has no corresponding partial block creates a fallback entry identified by its completion event.

Separate API message identities preserve separate replies even when their text is identical. Unit tests cover multiple block indexes, multiple API message IDs, repeated completion events, partial-text repair, completed-only display, and the deliberate naive behavior.

## Reproduce the duplicate and repair it

Naive mode deliberately appends the completed text to the same block that already contains its streamed text. The real response appears twice and the application reports CLASSROOM_DUPLICATE_RENDER. The SDK response remains successful. The report verifies the deliberate rendering outcome against each block's actual streamed and completed strings.

Restore reconciliation and run another real query. Its visible string matches the completed SDK text and final result, with zero extra displayed characters. Completed-only mode receives both message forms and displays the text when its completion arrives.

The UI shows actual delta and completion counts, rendered character counts, block identities, and final text verification. The server streams real observations to the browser, preserves reports under runs, and supports report download. Its local SSE transport uses the same frame buffering and UTF-8 decoding approach as Prompt 31. A disconnected browser aborts its active query.

Each query has a 90-second abort timeout, a one-turn agent-loop limit, and a USD 0.20 SDK budget limit. Tools, MCP servers, and filesystem setting sources are empty. The finally block clears the timer and closes the query. One experiment runs at a time.

## Exercise

Compare the three rendering strategies. Trace the actual API message ID and block index through deltas and completion. Edit the expectedText constant to change the response task, rerun the application, and verify that reconciled output still matches its completed text exactly. Repeat the duplicate completion unit case and confirm that separate replies with identical wording remain separate.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK streaming and completed-block message flow](https://code.claude.com/docs/en/agent-sdk/streaming-output)
- [TypeScript message types](https://code.claude.com/docs/en/agent-sdk/typescript)
