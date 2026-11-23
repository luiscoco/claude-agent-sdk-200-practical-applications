# Prompt 44 · Create a report with native Write and verify its contents

Create a new Markdown report through the actual Claude Agent SDK Write tool, inspect it with native Read, and independently verify the saved UTF-8 content, byte count and SHA-256.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43144. Run `npm run agent -- create` or `npm run agent -- blocked` for the CLI. Run `npm run typecheck` and `npm test` for offline checks.

## Actual file creation and Read-back

Every experiment creates a fresh runs/write-* working directory. The target is report.md inside it. Before starting the query, the application independently inspects that target and records its absence. The request provides the exact expected Markdown content, including the classroom facts, npm commands and WRITE-044 marker.

The query enables Write and Read. The model first calls native Write on the requested target, then calls native Read on that same file. The actual message loop retains tool inputs and matches native tool results by their tool-use IDs. The final SDK status and answer remain available in the report.

After the query, inspectReport uses Node to independently read the actual saved file. It records existence, UTF-8 contents, byte count and SHA-256. Verification requires the file to have been absent before the run, successful actual Write and Read tool results, Read after Write, an existing resulting file and exact requested contents. Expected and actual content hashes are displayed in a dedicated verification view.

The application preserves the full native Write input in the downloadable JSON report. Its concise tool-evidence view displays the target and content length. The requested and actual Markdown remain visible side by side. Download report.md from the actual generated file and compare its bytes and hash with the report.

## Genuine classroom Write denial and recovery

Blocked mode deliberately denies the native Write operation through the scoped classroom permission policy. The same predicate scopes canUseTool and PreToolUse to the requested target path. The actual hook decision, native tool result and permission-denial metadata are preserved. The independent inspection confirms that the report target remains absent. The actual Markdown download is unavailable for that denied run.

Restore report writing and run a fresh query. Its new target begins absent, native Write and Read execute successfully, and exact content and hash checks pass. Earlier generated reports retain their own separate target paths. Browser checks verify original-file preservation, actual Markdown bytes and hash, the native denial, recovery, JSON download, invalid mode rejection and responsive width.

Each query has a 90-second abort timeout, six agent-loop turns and a USD 0.75 SDK budget limit. Write and Read are the enabled built-in tools. MCP servers and filesystem setting sources are empty. finally clears the timer and closes the query. The local server permits one experiment at a time and stores observed reports under runs.

## Exercise

Change expectedContent, create the report through actual native Write, inspect the native Read result and compare the independently saved UTF-8 contents and SHA-256. Reproduce the classroom Write denial, confirm the absent target, restore writing and verify a new report. Download both the actual Markdown and its observed JSON evidence.

The original infographic and photo cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK TypeScript tools and messages](https://code.claude.com/docs/en/agent-sdk/typescript)
- [SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- [SDK PreToolUse hooks](https://code.claude.com/docs/en/agent-sdk/hooks)
