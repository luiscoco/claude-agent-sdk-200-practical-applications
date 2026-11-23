# Prompt 58 · Accurate tool annotations and application enforcement

Inspect actual MCP annotations and verify real read-only, replacement, deletion and idempotent state behavior. Every experiment starts with a fresh local classroom note file.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your own Anthropic API key. Run `npm start` and open `http://127.0.0.1:43158`.

The lesson was verified with Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322, MCP SDK 1.32.2 and Zod 4.6.7. Run `npm run typecheck` and `npm test`. Actual CLI examples are `npm run agent -- write-repeat false`, `npm run agent -- read false`, `npm run agent -- delete false` and `npm run agent -- delete true`.

## Declared and observed metadata

`read_note` declares `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true` and `openWorldHint: false`.

`set_note` and `delete_note` declare `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true` and `openWorldHint: false`. Replacement overwrites the existing value, and deletion removes the current note value. Repeated operations preserve the resulting note state and revision.

The app uses a local MCP client and linked in-memory transports to call `tools/list` on a server created by the same tool factory. The actual protocol result preserves all four declared hint fields. The actual SDK query connects its own fresh server instance and records native server status and real tool invocations.

In the observed pinned SDK status projection, the read tool exposes `readOnly: true`, and replacement and deletion expose `destructive: true`. The complete MCP listing remains available alongside this native projection in the report.

## Actual state implementation

Every actual agent experiment creates its own workspace and `note.json` initialized with `Original classroom note` at revision 0. `createNoteStore()` serializes operations through a queue. Reads preserve file content. A changed value advances revision and writes a temporary file before atomic replacement. Repeated same-value replacement and repeated deletion preserve the resulting state bytes.

The handler records full before and after SHA-256 fingerprints, actual outcome and process identifier. The UI shows hash prefixes, and checks compare full fingerprints. Unit tests also exercise concurrent updates, invalid direct writes and a successful retry after validation failure.

## Handler confirmation enforcement

Select **Try unconfirmed deletion** and run the actual tool. Its metadata describes destructive behavior. The handler checks the host confirmation selected in the application. With confirmation absent, it reads the current state and returns `DELETE_CONFIRMATION_REQUIRED`, preserving the original note and revision. The native tool result carries an actual error flag.

Select **Confirm classroom deletion** and run a fresh experiment. The first deletion sets the note to null and advances revision. The second preserves the resulting state and reports `changed: false`.

Annotation metadata describes behavior. The handler enforces host confirmation, input validation and the selected operation. The store implements serialization, atomic replacement and idempotent state transitions. MCP annotations require assessment of their source and the application's own controls.

## Verify and explore

Run repeated replacement and compare both after fingerprints. Run two reads and compare initial and final state and all before/after fingerprints. Reproduce the unconfirmed deletion error, confirm the operation and inspect repeated deletion.

Download the report for actual MCP metadata, native server status, initial/final state, handler executions, full hashes, native calls and results, lifecycle provenance and final structured output. Reports remain local in `runs/`, and the download index clears on restart.

The query and in-process server close after consumption. Each query has a ninety-second abort. The HTTP app serializes experiments, while the store also queues individual tool operations. Actual inference requires network access and incurs provider charges.

The original infographic and approved author-photo cover are included with provenance.

## References

- [Agent SDK custom-tool annotations](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [MCP tools and annotation trust](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- Actual `tools/list` responses and native SDK status observed with the pinned dependencies.

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
