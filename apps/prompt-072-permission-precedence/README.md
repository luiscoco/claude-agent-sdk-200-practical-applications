# Prompt 72 · Verify conflicting permission rules

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43172`. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local port.

Experiments use actual SDK and provider calls with normal usage charges. Run `npm run typecheck` and `npm test` for compilation and rule configuration checks. The original infographic, instructor cover and source viewer are included.

## Native rule comparison

Each run creates a fresh owned workspace and synthetic `classroom-note.txt`. The task calls native Read once on that file. Inline `settings.permissions` uses the same scoped `Read(./classroom-note.txt)` rule in the selected lists. Filesystem settings sources are empty and permission mode is `default`.

- **Deny + ask + allow** supplies the same rule in all three lists. The actual Read returns a permission error, the approval callback receives zero requests and the structured result records denial.
- **Ask + allow, host denies** omits the deny rule. The native request reaches `canUseTool` despite its matching allow rule. The host's actual denial is returned as a native tool error.
- **Ask + allow, host approves** uses the same rules with an approving host callback. The callback receives the native request identifier and returns the original input. Read succeeds and its exact text reaches the final output.
- **Allow only** supplies the allow rule with empty ask and deny lists. Read succeeds with zero approval callback requests.

The official evaluation guide places deny rules ahead of ask rules, and ask rules ahead of allow approval. The recorded comparisons verify those outcomes for the same owned file operation.

## Observed file-path precheck

In the pinned native runtime, the file-path deny case returns `File is in a directory that is denied by your permission settings` before the Read `PreToolUse` hook runs. The report preserves an empty hook list for that case, the actual attempted Read and its native error. The other three configurations invoke the hook once. The verifier checks these actual counts explicitly.

The hook validates the owned path and one operation. A valid request returns an empty object and leaves native rules to decide. The host callback approves only in ask-approved mode. Successful reads compare their native reply and final exact text with the actual synthetic input file. Every mode verifies that the original input file remains intact.

The reports include raw native call identifiers, results, hook requests, host callback decisions, active rule lists, actual session identifier and final verification. Runtime reports redact the configured API key and are written under `runs/`. A fresh server process starts a new download index.

## CLI and exercise

Run `npm run agent -- deny-wins MCP`, `npm run agent -- ask-denied MCP`, `npm run agent -- ask-approved Hooks`, or `npm run agent -- allow-only Hooks` for actual JSON evidence. A failed verification returns a nonzero exit code.

For the exercise, use Hooks under all four configurations. Explain the native error or exact returned text, callback count, host decision and observed hook count. Preserve the downloaded evidence for each comparison.

The student archive includes source, tests and original assets. Runtime artifacts, secrets, dependency folders and teacher recordings are excluded.

## References

The permission guide documents the rule evaluation sequence and host callback behavior. [Claude Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)

The SDK reference documents inline settings and filesystem setting sources. [Claude Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
