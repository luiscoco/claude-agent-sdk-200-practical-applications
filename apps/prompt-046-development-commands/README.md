# Prompt 46 · Approved development commands

Run an actual native Bash tool through Claude Agent SDK. Compare successful execution, a deliberate exit status 7 and a six-second command with a one-second foreground timeout. The app preserves native tool results, hook responses, task notifications and independently captured command streams and exit status.

## Run locally

Install Node.js 22 or later and Git for Windows with Git Bash available. On macOS or Linux, provide Bash. Install the pinned dependencies with `npm ci`. Copy `.env.example` to `.env` and configure your own Anthropic API key locally. Run `npm start` and open `http://127.0.0.1:43146`.

The three menu entries select fixed classroom commands. The permission callback and pre-tool hook check the full command and selected timeout. Each run creates a fresh workspace. The supplied script prints a diagnostic to stderr even on success, which helps students inspect stream separation and the actual exit status.

Use `npm run agent -- success`, `npm run agent -- failure` or `npm run agent -- timeout` for CLI evidence. `npm run typecheck` and `npm test` verify the code and boundary cases. Real SDK runs require network access and incur inference charges.

## Actual evidence and timeout behavior

The shell wrapper saves stdout, stderr and its immediate `$?` exit status in separate files before returning the same status to native Bash. A nonce ties the process receipt to the current run. An absent exit-status receipt is represented by `null`.

The pinned Agent SDK is 0.3.322 with bundled Claude Code 2.1.322. In this version a foreground Bash timeout can auto-background the command. The lesson verifies the actual `timedOutAfterMs`, `backgroundTaskId` and subsequent `task_notification` with status `completed`. The supplied slow task finishes after six seconds. Its final shell exit status is 0. The UI presents foreground timeout and command completion as separate observations.

The deliberate failing command returns 7 and produces a native error result and `PostToolUseFailure`. Claude can successfully describe this failure, so the SDK conversation's result status and the executed command's exit status are displayed separately.

Download the observed report to inspect the exact command, native calls, hook payloads, system task events, captured files and verification. Reports remain local in `runs/`. Restarting the app clears its in-memory download index. The original infographic and branded cover are included with provenance.

## Student exercise

Run all three scenarios. Compare their stdout, stderr, shell exit status and SDK conversation status. Locate the one-second foreground timeout and match its background task ID to the completion notification. Restore the successful command after the exit-7 demonstration and download the evidence. Inspect the fixture code and change its diagnostic text for a new classroom experiment.

## References

- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- [Agent SDK hooks](https://code.claude.com/docs/en/agent-sdk/hooks)
- Installed official declarations `@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts`, `BashInput` and `BashOutput`, and `sdk.d.ts`, `SDKTaskNotificationMessage`.

The course description must disclose AI-assisted content creation and synthetic narration. The instructor reviews accuracy and the final editorial presentation before release.
