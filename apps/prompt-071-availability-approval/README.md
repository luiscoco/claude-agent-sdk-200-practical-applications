# Prompt 71 · Tool availability, preapproval and denial

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43171`. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local port.

Each experiment uses actual SDK and provider calls with normal usage charges. Run `npm run typecheck` and `npm test` to check the source and classroom configuration rules. The original infographic and instructor cover are included.

## Four actual native configurations

Every run creates a fresh owned workspace containing one synthetic note. The task reads it and tries to copy its exact text to a classroom report when Write is advertised. The app preserves native initialization, actual tool requests and results, approval callbacks and the real output-file check.

- **Select Read only** sets `tools: ['Read']`. Native initialization omits Write and the task reports its absence.
- **Approval required** selects Read and Write with an empty `allowedTools` list. Write remains advertised. The actual operation reaches the host's `canUseTool` callback, which returns a classroom denial. The native result records that denial and the output file is absent.
- **Preapprove Write** selects both tools and sets `allowedTools: ['Write']`. The native runtime approves the valid Write before consulting `canUseTool`. The actual output file contains the exact note text.
- **Deny Write** selects both tools and sets the whole-tool rule `disallowedTools: ['Write']`. The pinned native runtime removes Write from the advertised tools. The report preserves that actual advertisement and absent output file.

Read operates on the local working-directory fixture and is approved by native read behavior. A `PreToolUse` hook validates the owned file paths, exact Write content and one attempt per tool. For valid requests it returns an empty object, leaving native permissions to decide. Additional or mismatched operations receive a hook denial.

The preapproved mode emits the SDK's `CLAUDE_SDK_CAN_USE_TOOL_SHADOWED` warning because its bare Write allow entry resolves before the host callback. The report verifies zero callback requests in that configuration against the actual file outcome.

## Evidence and exercise

Each report compares configured tool selection, actual native advertisement, valid request identifiers, callback invocations, native tool outcomes, file existence and final structured output. Runtime reports redact the configured API key and are stored under `runs/`. A fresh server process starts a new download index.

Run `npm run agent -- selected MCP`, `npm run agent -- unapproved MCP`, `npm run agent -- preapproved Hooks`, or `npm run agent -- denied Hooks` to inspect actual JSON evidence. Failed verification returns a nonzero exit code.

For the exercise, use the Hooks topic under all four configurations. Explain the observed Write advertisement, callback count and output-file state for each run. Compare the exact note text with the successful native Write result.

The student archive includes source, tests and original assets. Runtime artifacts, secrets, dependency folders and teacher recordings are excluded.

## Reference

The official permission guide documents tool preapproval, whole-tool denial and native evaluation before the host callback. [Claude Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
