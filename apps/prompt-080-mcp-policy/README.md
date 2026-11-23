# Prompt 80 · MCP-specific policy

Author: Luis Coco Enríquez

Apply supported per-tool or per-server MCP permission policies and verify how they interact with session permissions.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, then run `npm start`. Open `http://127.0.0.1:43180`. The default model is `claude-sonnet-4-6`. You can set `CLAUDE_MODEL` and `PORT` locally.

Select a policy configuration and MCP or Hooks, then run the actual experiment. Every run creates a fresh owned workspace. The in-process SDK MCP tool saves one synthetic classroom note. Inspect the native mode, actual callback count, handler execution, independently read file and final structured result.

Run `npm run typecheck` and `npm test` to check the project. For a command-line experiment, run `npm run agent -- ask-allow MCP`. Other mode arguments are `preapproved`, `ask-deny`, `unattended`, `policy-deny` and `bypass-ask`.

## Policy and session interaction

All six configurations preapprove the server with `allowedTools: ['mcp__classroom__*']`. The per-tool policy list belongs beside the spread SDK server configuration and uses the bare tool name `save_note`.

| Configuration | Native session mode | Tool policy | Actual host callbacks | Actual handler executions |
| --- | --- | --- | --- | --- |
| Server preapproval | default | empty policy list | 0 | 1 |
| Always ask, host allows | default | always_ask | 1, allow | 1 |
| Always ask, host denies | default | always_ask | 1, deny | 0 |
| Always ask, unattended | dontAsk | always_ask | 0 | 0 |
| Always deny | default | always_deny | 0 | 0 |
| Always ask, local bypass | bypassPermissions | always_ask | 1, deny | 0 |

These observations were verified with TypeScript SDK 0.3.322 and bundled native runtime 2.1.322. Under this pinned runtime, `always_deny` leaves the tool advertised and returns a native denial. Anthropic's current reference documents removal from context starting with native version 2.1.324. The interface records the actual advertisement state, and verification supports that removal case as an unavailable tool.

The installed SDK emits a general callback-shadowing warning for the server allow wildcard and bypass mode. The actual `always_ask` experiments still produce the recorded callback. Use the preserved native events and handler/file checks to inspect each measured outcome.

The `bypass-ask` case runs locally, with `allowDangerouslySkipPermissions` explicitly enabled and the remote-session environment marker omitted. The host response is preselected by the experiment configuration. Prompt 76 supplies the live operator-decision interface.

## Exact operation and evidence

Only this owned SDK server is configured, and built-in tools are omitted. The tool's input accepts the two classroom topics. The handler writes to a fixed file inside the current run's workspace. Its annotations describe an owned write, and the input hook validates the actual tool name, topic and one-operation limit while preserving native permission evaluation.

Native callback records preserve the actual tool use identifier and allow or deny decision. The verifier compares callback counts, real handler admission, native success/error results, independently read file bytes and the model's final structured result. Each observed report includes its actual SDK session identifier and timestamp.

The server preapproval experiment is a baseline. Repeat it with `always_ask`, inspect the extra host callback, deny a fresh request and compare its absent file. Then switch to `dontAsk` and observe the native denial with zero host callbacks. Return to an approved Hooks request to verify a fresh successful handler execution after denial.

The original infographic is reused unchanged with recorded provenance. The cover follows the approved photo, Claude icon and author-credit style. Video narration uses the approved Inworld Yash settings. API credentials are configured locally and excluded from exported student materials.

## References

- [Anthropic SDK MCP tool policies and native-version requirements](https://code.claude.com/docs/en/agent-sdk/typescript#mcpsdkserverconfigwithinstance)
- [Anthropic per-tool approval configuration](https://code.claude.com/docs/en/agent-sdk/custom-tools#require-approval-for-specific-tools)
- [Anthropic native permission evaluation](https://code.claude.com/docs/en/agent-sdk/permissions)
