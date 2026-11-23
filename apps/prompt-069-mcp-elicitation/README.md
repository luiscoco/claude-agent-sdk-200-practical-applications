# Prompt 69 · MCP form elicitation and native classroom interaction

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, then set your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43169`.

`CLAUDE_MODEL` defaults to `claude-sonnet-4-6`, and `PORT` changes the local app port. Each interaction performs real model and MCP operations with normal provider usage. Run `npm run typecheck` and `npm test` for compilation and regression checks.

The app includes its original infographic, instructor cover, actual source viewer and downloadable interaction reports. Classroom topics, report text and format choices are synthetic.

## Three actual native request stages

1. The model calls `AskUserQuestion` with the MCP and Hooks classroom options. The SDK routes this interactive built-in through `canUseTool`. The host validates the actual question, displays it, and returns the selected topic in its native answer mapping.
2. The model requests `mcp__survey__prepare_report` with that topic. The host receives the actual tool permission request through `canUseTool` and waits for the operator's approval or denial. The argument hook returns `{}` for the valid first request, preserving native permission evaluation.
3. During an approved tool call, the actual MCP server invokes `elicitInput` with form mode and a required `format` field. The SDK delivers that server request through `onElicitation`. The host displays the actual schema and returns accepted content, decline, or cancel to the server.

The request history records the native payload and submitted classroom answer for each stage. The verifier checks actual callback identities, handler admission, elicitation count, server-observed response, native tool outcome and final structured output.

## Outcomes and recovery

Accepting the form returns the selected brief or detailed report. Declining it produces the actual server's `ELICITATION_DECLINED` outcome. Cancelling that server request produces `ELICITATION_CANCELLED`.

Denying the tool permission produces the native `TOOL_DENIED` outcome with zero server handler events and zero MCP form requests. A new accepted interaction supplies a fresh recovery run and its own evidence.

**Cancel active run** aborts the live SDK operation. The host cancels its pending request, closes the query and records any available partial report. A new run becomes available after cleanup.

## Active local jobs and answer validation

The local host retains each active query and its request broker in memory. A fresh browser context attaches to the same active job and pending native request. Completed jobs retain their report download during that host process. A new process starts a fresh job and download index.

The host admits one active run at a time. Invalid or stale answers preserve the current pending request. Each accepted answer resolves its request once, with native abort signals cleaning up cancelled requests. Regression checks cover these lifecycle cases and actual MCP form acceptance and decline.

This classroom server publishes one supported form schema with brief and detailed choices. The host validates the actual server identity, form mode and schema before displaying it. Native callback payloads and the server audit remain available in the report.

## CLI and exercise

The CLI supplies explicit classroom answers programmatically. Run `npm run agent -- accept brief MCP`, `npm run agent -- accept detailed Hooks`, `npm run agent -- decline`, `npm run agent -- cancel`, or `npm run agent -- tool-denied`. These commands execute the real native callbacks and MCP operations. An unsuccessful verification returns a nonzero exit code.

For the exercise, choose Hooks, approve the actual tool, and submit the detailed form. Compare all three native request kinds and their actual handler evidence. Repeat with a declined form and trace its server outcome.

The student archive includes source, original assets and tests. Runtime artifacts under `runs/`, credentials, dependency folders and teacher recordings are excluded. Runtime report redaction checks the exact configured API key value.

## References

The official SDK reference documents `onElicitation` and its native result. [Claude Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)

The MCP integration documentation describes server-originated form requests and negotiated support. [Claude Code MCP elicitation](https://code.claude.com/docs/en/mcp#respond-to-mcp-elicitation-requests)
