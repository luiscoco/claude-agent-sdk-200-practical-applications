# Prompt 70 · Recover from actual MCP failures

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43170`.

`CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local port. Each experiment uses actual SDK and provider calls with normal usage charges. Run `npm run typecheck` and `npm test` for compilation and the focused MCP regression checks.

The app includes the original infographic, instructor cover, actual source viewer, native diagnostic evidence and downloadable run reports.

## Controlled classroom failures

The owned local stdio server supplies synthetic classroom rows. Its three explicit modes demonstrate actual native behavior.

- **Disconnected** advertises `get_items` and exits its own process during the first call. The native reply contains `Connection closed`. The host restores the local fixture, calls `reconnectMcpServer('service')`, verifies a new server process and requests a bounded result.
- **Unavailable** connects successfully while advertising no `get_items` tool. The host diagnoses this from actual discovery before submitting any model task. It restores the fixture, reconnects the server, verifies the new advertisement and then submits the recovery task.
- **Oversized** returns 400 synthetic rows under an explicitly configured `MAX_MCP_OUTPUT_TOKENS` budget of 2,000. The tested native runtime saves the payload to a file and returns a persisted-output notice. The host verifies the owned file and requests a smaller direct result in the same live session.

The page-size control accepts integers from 1 through 10. Every recovery compares the native result, actual server audit, exact row identifiers and final structured output.

## Native observations and evidence

The pinned runtime can retain a cached `connected` server status after the actual disconnect. The report preserves that value and diagnoses the failure from the actual call error and owned-process exit audit.

The observed oversized-output notice has no true native error flag. The verifier recognizes its actual persisted-output marker, resolves the file inside its owned run directory, parses the complete synthetic JSON and compares its SHA-256 with the server's actual payload hash. Reports retain the native flag as observed. The explicitly lowered classroom token budget makes this small example reproducible.

The SDK query receives a held asynchronous input stream. This keeps its control channel available between diagnosis and recovery. Reconnection uses the actual query control method. The host checks the new native advertisement before releasing the recovery task. Oversized-output recovery requests a bounded response from the already connected server. Phase results preserve the actual native session identifier.

The permission hook admits one exact tool call per phase and denies additional or mismatched attempts. The diagnostic phase for unavailable tools submits zero model prompts. Tools and output rows are freshly generated local teaching fixtures.

The full native notice is retained as evidence. File verification operates on the known synthetic JSON in the owned directory. The host validates the resolved path, payload structure and actual hash before recording success.

Runtime artifacts are stored under `runs/`. Reports redact the configured API key. Download indexes are held by the current server process. Student archives include source, tests and original assets, with runtime artifacts, credentials, dependency folders and teacher recordings excluded.

## CLI and exercise

Run `npm run agent -- disconnected 5`, `npm run agent -- unavailable 5`, or `npm run agent -- oversized 10` to inspect actual JSON evidence. An unsuccessful verification returns a nonzero exit code.

For the exercise, choose unavailable mode and page size 3. Inspect the initial connected server with no tool advertisement, zero model prompts at diagnosis, changed server process identifier, new advertisement and recovered identifiers 1, 2 and 3. Repeat oversized mode with page size 10 and verify all 400 persisted rows against the actual handler hash before inspecting the bounded ten-row result.

## References

The official SDK reference documents native MCP status and reconnection control methods. [Claude Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)

The MCP documentation describes the configurable output token budget and native output persistence. [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp)
