# Prompt 29 · Interruptions

Interrupt an active SDK turn, consume its remaining events, and continue with a new instruction in the same streaming conversation.

## Run the application

Use Node.js 22 or later and Git Bash on Windows. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43129. Run `npm run agent` for the automatic CLI demonstration. Run `npm run typecheck` and `npm test` for the offline checks.

Start the waiting turn. The model requests the fixed foreground Bash command that sleeps for 20 seconds and prints a marker. The PreToolUse hook records the actual request and allows that exact command with foreground execution. Interrupt while its waiting turn is active. The hook observation establishes that the tool was requested. The native interruption events establish the actual runtime outcome.

The application sends query.interrupt(), preserves its returned receipt, and keeps consuming the same query output iterator. A receipt acknowledges the control request. The consumer waits for the native interrupted-turn result before enabling the next input. The recorded CLI and browser experiments produced error_during_execution with is_error true and terminal_reason aborted_tools. Their remaining SDK user events included the interrupted tool result and the interruption notice. Event details in the interface preserve their actual payloads.

After the interrupted result, send a new text instruction. The application yields a fresh UUID-stamped user message through the existing async input queue. The real answer CONTINUED arrives with a successful result in the same native session. The verifier checks native interruption, receipt, follow-up UUID correlation, successful completion, and session continuity.

The native interrupt receipt's still_queued list is a snapshot of pending UUID-stamped inputs. This lesson sends the follow-up after the first result, and its recorded receipts were empty. Earlier CLIs can return no receipt payload. The report preserves that outcome as null and separately tracks receiptReceived.

## Error and repair

Send an empty follow-up after the interrupted result. The application raises INVALID_FOLLOWUP before assigning another UUID or mutating the input queue. Restore the follow-up text and send it in the same session. The UI also prevents follow-up submission during draining, and the server enforces DRAIN_REQUIRED for direct requests in an earlier stage.

Each experiment uses one real query, a 120-second session timeout, a four-turn agent-loop limit, and a USD 1 SDK budget limit. Bash is restricted to the exact classroom waiting command. MCP servers and filesystem setting sources are empty. Completion, explicit close, timeout, and stream exceptions end the input and close the query. The server closes its sessions during shutdown. The next resource-cleanup lesson verifies subprocess termination separately.

Reports can be downloaded from the UI. Their full native results and observable assistant text, tool calls, user tool results, and application control events are preserved. Event details are expandable. Model-internal thinking blocks are excluded from the event display.

## Exercise

Start another waiting turn, interrupt it, and inspect the remaining event order. Send `Reply with exactly READY_FOR_CLASS` after the interrupted result. Confirm the same native session and the new input UUID. Reproduce and repair the empty-follow-up guard.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [TypeScript query interrupt and SDKControlInterruptResponse](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Persistent streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
