# Prompt 51 · Typed TypeScript calculator tool

Define an actual typed calculator with the Agent SDK's `tool()` helper, register it with `createSdkMcpServer()` and let the real agent call it. Compare the application handler execution, native MCP tool result and final structured outcome.

## Run locally

Install Node.js 22 or later and run `npm ci`. Copy `.env.example` to `.env` and configure your own Anthropic API key locally. Run `npm start` and open `http://127.0.0.1:43151`.

Select addition, subtraction, multiplication or division and provide finite operands between -1000000 and 1000000. The default request is 24 + 18. The application validates the input before starting the paid SDK query.

The Zod raw shape passed to `tool()` supplies the handler's inferred argument types. The handler calculates the actual result and returns text content, structured content and an `isError` flag. Its execution log records the exact arguments, outcome, process ID and timestamp. Results use JavaScript number arithmetic. Non-finite results return a domain error, and negative zero is normalized for consistent JSON comparison.

## Register and observe the actual tool

The in-process MCP server is registered under `calculator`, so the fully qualified tool name is `mcp__calculator__calculate`. `allowedTools` pre-approves that tool. A `PreToolUse` hook checks the exact requested operation and operands. The SDK `tools: []` option removes the built-in tool set from this classroom agent's context. The SDK output-format mechanism supplies its structured-result formatter.

The application compares actual handler input, host and handler process IDs, native result JSON and final structured output. It also checks the native hook's server provenance with `name: "calculator"` and `source: "sdk"`. Successful native user-message metadata includes the callback's structured content. The division-by-zero error is preserved in the native error result's text content.

The query and in-process server are closed after each run. Actual native calls, tool results, hook metadata and execution checks remain available in the observed report.

## Error and repair

Use **Try division by zero**, then run the tool. The actual handler returns `DIVISION_BY_ZERO` with `isError: true`, and the native tool result preserves that domain error. The SDK agent returns the same structured error outcome. Use **Restore 24 + 18** and run a fresh successful request to obtain 42.

Download the observed report to compare the exact input, actual in-process execution, native server provenance, tool result and final outcome. Reports remain local in `runs/`, and restarting clears the in-memory download index. The original infographic and author-photo cover are included with provenance.

## Verify and explore

Run `npm run typecheck` and `npm test`. Use `npm run agent -- add 24 18` or `npm run agent -- divide 24 0` for real CLI runs. Real SDK inference requires network access and incurs provider charges.

For an exercise, run a different operation and operands. Compare the actual handler arguments with the native call, inspect its structured content and final result, reproduce division by zero and restore the successful request. Inspect the schema and handler code to add another classroom operation.

## References

- [Create and call custom Agent SDK tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Zod documentation](https://zod.dev)

Pinned versions include Agent SDK 0.3.322, native Claude Code 2.1.322 and Zod 4.6.7. Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
