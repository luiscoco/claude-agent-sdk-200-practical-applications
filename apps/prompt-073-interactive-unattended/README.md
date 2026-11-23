# Prompt 73 · Default permission handling and dontAsk

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43173`. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local port.

Experiments use actual SDK and provider calls with normal usage charges. Run `npm run typecheck` and `npm test` for compilation and configuration checks. The app includes the original infographic, instructor cover and source viewer.

## Same potentially sensitive operation

Every experiment selects Read and Write. A fresh owned workspace contains a synthetic note. The actual task reads that file and requests a Write containing its exact text. Writing modifies the local filesystem, providing a controlled example of an operation that requires approval under default permission handling.

The classroom operator chooses the host's fixed approval decision before starting the run. The SDK's actual `canUseTool` callback records the native request identifier, name, input and chosen decision. The example's callback uses this explicit preselected policy.

- **Default, host approves** uses `permissionMode: 'default'` and an empty allow list. Write reaches the callback, receives allow with the original input, and creates the actual report file.
- **Default, host denies** uses the same native settings. The callback returns the selected denial. The native tool result records the denial and the output file remains absent.
- **dontAsk, no preapproval** uses `permissionMode: 'dontAsk'` and an empty allow list. The native runtime denies the Write without invoking the host callback. The actual file remains absent.
- **dontAsk, preapprove Write** keeps `dontAsk` and adds `allowedTools: ['Write']`. Native preapproval completes the actual Write with zero host callback requests.

Read operates on the local working-directory fixture. A `PreToolUse` hook validates the one expected Read and one exact Write path and content. Valid requests return an empty object, preserving native mode and rule evaluation. Unexpected or additional operations receive a hook denial.

The preapproved configuration emits the SDK's documented bare-tool callback-shadowing warning. The report verifies native behavior using actual callback counts, tool result identifiers and file contents.

## Evidence and exercise

Reports compare actual tool advertisement, exact attempts, native outcomes, host decisions, output-file existence, exact text and final structured output. Runtime reports redact the configured API key and are stored under `runs/`. A new server process starts a new download index.

Run `npm run agent -- default-allow MCP`, `npm run agent -- default-deny MCP`, `npm run agent -- dont-ask Hooks`, or `npm run agent -- preapproved Hooks` for actual JSON evidence. Failed verification returns a nonzero exit code.

For the exercise, use Hooks under all four configurations. Record actual Write attempts, native success or denial, host callback count and real output-file state. Explain how explicit preapproval affects the unattended mode.

The student archive includes source, tests and original assets. Runtime artifacts, secrets, dependency folders and teacher recordings are excluded.

## Reference

The official guide describes default callback fallthrough, unattended denial and native allow-rule evaluation. [Claude Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
