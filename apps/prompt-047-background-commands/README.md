# Prompt 47 · Background commands

Start a real native Bash background command, observe live process output and native completion, and cancel an active task with the SDK's `query.stopTask(taskId)` control method. The application preserves actual task IDs, native responses, system events, process receipts, command output and shell status receipts.

## Run locally

Install Node.js 22 or later and Git for Windows with Git Bash available. macOS and Linux require Bash. Run `npm ci`. Copy `.env.example` to `.env` and configure your own Anthropic API key locally. Run `npm start` and open `http://127.0.0.1:43147`.

Select the six-second completion task or twenty-second cancellation task. Start it and observe its real task ID and output. Use **Stop actual task** while the cancellation task is running. **Start fresh completion run** restores a new successful experiment after the previous session closes.

The supplied classroom commands are fixed. Native Bash receives `run_in_background: true` and a 60000 ms background timeout. A permission callback and pre-tool hook check the exact command and these fields. Each command has a bounded fixture lifetime and writes inside its own fresh workspace.

The app uses the streaming-input message queue from the conversation lessons to keep the SDK query open while background work runs. A native `task_notification` with the matching task ID establishes completion or cancellation. The host closes the query after this terminal event and any pending stop acknowledgement. A ninety-second application timer bounds the overall experiment.

## Real cancellation evidence

The host calls `query.stopTask(taskId)` and records its acknowledgement. The SDK emits the actual `stopped` task notification. The application separately probes the actual fixture process from its nonce-matched PID receipt and checks that it has exited. The fixture's completed marker is absent after the recorded cancellation.

An interrupted wrapper can finish without writing its shell exit receipt. The UI preserves this as **No status receipt**, represented by JSON `null`. The native task status, stop acknowledgement and observed process state establish the cancellation outcome.

The completion scenario preserves a native `completed` notification, the actual completed marker and shell exit status 0. Download the observed report to inspect the full evidence. Reports remain in `runs/`, and restarting clears the app's in-memory session index.

## Verify and explore

Run `npm run typecheck` and `npm test`. Use `npm run agent -- complete` or `npm run agent -- cancel` for actual CLI runs. Real SDK runs require network access and incur inference charges. Browser automation used to produce the lesson is excluded from the student package.

For an exercise, compare live ticks and the native terminal events for both scenarios. Attempt cancellation after a completed task through the exposed `window.lesson.cancel()` developer-console action and inspect the actual state guard response. Start a fresh completion run and download its evidence. Change the supplied fixture's diagnostic text for another classroom experiment.

## References

- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [SDK hooks](https://code.claude.com/docs/en/agent-sdk/hooks)
- Installed official SDK 0.3.322 declarations for `Query.stopTask`, `BashInput`, `BashOutput` and `SDKTaskNotificationMessage`. The bundled native Claude Code version is 2.1.322.

The original main infographic and author-photo cover are included with provenance. The course description must disclose AI-assisted creation and synthetic narration. The instructor reviews final accuracy and editorial presentation before release.
