# Prompt 96 · Session browser

Author: Luis Coco Enríquez

List sessions and retrieve their metadata and messages to build a simple transcript viewer.

## Run the application

Install Node.js 22 or later, extract the project and run `npm ci`, then `npm start`. Open `http://127.0.0.1:43196`. `PORT` overrides the local port. This application makes no model queries and requires no API key.

Run `npm run typecheck` and `npm test` for source checks and actual native SDK session-reading checks. Run `npm run agent -- switch 0` to inspect the first two conversation messages. Use `denied` for the other recorded session, `2` for the next offset, or add `--system` to include system messages.

## Historical recordings, actual utility calls

The fixtures are unchanged copies of two successful native transcripts from the owned synthetic Prompt 89 classroom experiments. They are historical recordings, not new generated conversations and not invented session JSON. Their source-evidence paths and original SHA-256 hashes are recorded in `fixtures/catalog.json`. Both concern the classroom MCP note experiment; one allowed a model switch and one denied it. The native metadata titles happen to match, so separate classroom labels identify the two runs without renaming their actual metadata.

The application sets its process-local `CLAUDE_CONFIG_DIR` to `fixtures/native-config` before importing the SDK. It never browses the user's normal Claude configuration. The reader calls the installed SDK's actual `listSessions()`, `getSessionInfo()` and `getSessionMessages()` functions against these persisted JSONL copies. It does not call `query()` or resume a model conversation.

The fixtures retain original working-directory metadata. These historical paths are displayed as metadata; the reader does not require the original source directories or access them. Utility reads omit the `dir` selector and search only the application's isolated fixture configuration. This also keeps the sample independent of the folder into which students extract it.

## Listing, metadata and messages

`listSessions()` returns actual native identifiers, summaries, working directories, modification times and available metadata. `getSessionInfo()` independently reads the selected native session's metadata. `getSessionMessages()` returns the supported conversation sequence rather than treating every JSONL row as an ordinary chat message. The viewer preserves native message UUIDs and roles.

Message pages use actual SDK `limit` and `offset` options. The report compares the returned page with the corresponding slice of the full SDK message sequence. The include-system checkbox uses `includeSystemMessages`; counts may differ depending on which supported system entries the recording contains. The role selector filters only the current page in the browser and is explicitly labelled as a display choice.

Text, tool calls and tool results are rendered as text rather than interpreted as HTML. Thinking blocks are omitted from the classroom display and labelled as omitted; they are not presented as explanatory instructor narration. The original transcript files and SDK results remain the evidence source.

## Verification and controls

Each native read verifies that both expected recorded sessions are listed, list pagination agrees with native ordering, selected metadata identifies the intended session and returned message UUIDs/roles/content match actual transcript rows. Message pagination must agree with the full SDK sequence. A newly generated unknown identifier must produce no metadata and no messages. The selected transcript's hash must match its provenance before reading and remain unchanged afterward.

The meaningful native utility test reads successive pages, requires them not to overlap, compares two different actual sessions, includes system-message retrieval and checks unchanged hashes. Playwright checks selection, next/previous pages, role display, native reads, report download, source allowlisting, invalid input, original assets and mobile width. These are read-only native SDK operations, not mocked model responses.

## Student exercise

Select either historical run and compare its native metadata with the listing. Retrieve successive SDK message pages and compare their UUIDs. Filter the current page to assistant messages, then restore all roles. Include system messages and inspect whether the actual recording contains any supported system entries. Select the other session and explain why equal summary titles do not imply equal native session identities.

The application is a local classroom browser of two owned recorded fixtures. It does not demonstrate authentication for a multi-user session service. `runs` contains generated read reports; fixtures are read without mutation. The export includes the actual fixture files and source provenance so students can reproduce these reads without model credits.

The original infographic is reused unchanged with image provenance. The approved cover retains the instructor portrait, Claude icon and `Author: Luis Coco Enríquez` below the portrait. Video narration uses the requested Inworld Yash parameters.

## References

- [Anthropic TypeScript SDK session utilities](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Anthropic session persistence and history](https://code.claude.com/docs/en/agent-sdk/sessions)

## Public repository fixtures

The recorded classroom transcripts in this public copy have sanitized machine paths and short project-directory names. The catalog records hashes of the sanitized files and their original source hashes. These historical fixtures are not newly generated model results.
