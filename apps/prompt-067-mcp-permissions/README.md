# Prompt 67 · Fully qualified MCP permission rules

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, then configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43167`.

`CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` can change the app's local port. Each experiment makes a real model-driven SDK query and incurs normal provider usage. Run `npm run typecheck` and `npm test` for the compilation and local MCP regression checks.

The application includes its original infographic, instructor cover, actual source viewer and downloadable native evidence. The stdio MCP server supplies two synthetic read-only tools backed by a classroom catalog.

## Compare actual native rules

Every experiment asks the model to attempt `mcp__catalog__read_lesson` and `mcp__catalog__list_lessons` once each. Both tools are advertised. The host uses `permissionMode: 'default'` and passes the selected entry directly through `allowedTools`.

- **Server-wide** uses `mcp__catalog__*`. The actual native runtime auto-approves both calls. Two server handlers execute and the host `canUseTool` callback receives zero requests.
- **Individual** uses `mcp__catalog__read_lesson`. The read handler executes. The list request falls through native rule evaluation to the host callback, which denies that classroom request. Its native error and the single handler event are preserved.
- **Unanchored** uses `mcp__*`. The installed native runtime ignores that unanchored allow pattern. Both calls reach the denying callback, with zero actual server handler executions. Restore the catalog-scoped wildcard to repair the configuration.

Fully qualified names identify the configured MCP server and tool. The tested server-wide allow pattern places its wildcard after the literal `mcp__catalog__` prefix.

The argument-validation `PreToolUse` hook records each actual request. For a valid first attempt with exact classroom arguments it returns `{}`, allowing the native permission evaluation to proceed. It denies unexpected inputs and additional attempts. The report preserves those requests and native errors if they occur.

## Native callback and evidence

The host callback records actual requests that reach `canUseTool`, including native tool-use identifiers. It returns a deterministic classroom denial. Native auto-approved calls bypass that callback. The application verifies the observed callback names, actual server handler admission, native successful outcomes, denied native results and final structured output.

The pinned TypeScript SDK can emit `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` for bare allow entries. The runtime evidence records which calls actually reached the callback for each tested mode, including the unanchored rule example.

All catalog content is synthetic. Run artifacts are stored under `runs/`. Reports retain native session identifiers, configured rules, model calls, callback decisions and server events. Runtime report redaction checks the exact configured API key value. A fresh local server process starts a new in-memory download index.

The student archive includes source, fixtures, tests and original lesson assets. Runtime outputs, credentials, dependency folders and teacher recordings are excluded.

## CLI and exercise

Run `npm run agent -- individual local-mcp`, `npm run agent -- server-wide local-mcp`, or `npm run agent -- bad-prefix local-mcp` for actual JSON evidence. An unsuccessful verification returns a nonzero exit code.

For the exercise, use `agent-loop` as the lesson slug and compare individual and server-wide modes. Explain the actual callback count, handler events and returned lesson title from each completed run.

## References

The current official documentation describes anchored MCP allow patterns and native evaluation before the host callback. [Claude Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)

Tool names use the configured server key and registered tool name. [Claude Agent SDK MCP integration](https://code.claude.com/docs/en/agent-sdk/mcp)
