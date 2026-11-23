# Prompt 93 · Resume after restart

Author: Luis Coco Enríquez

Restart the application and resume a specific stored session using its identifier.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Configure `ANTHROPIC_API_KEY` locally, run `npm start` and open `http://127.0.0.1:43193`. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the local port. Actual native queries use your account.

Run `npm run typecheck` and `npm test` for source and saved-session loader integrity checks. `npm run agent -- resume MCP` runs the coordinated restart comparison. Use `fresh` instead of `resume` for the intentional context-loss control. Topics are `MCP` and `Hooks`.

## Independent application invocations

Run `npm run session -- seed MCP`. This is an actual application process that creates a native session, captures its SDK identifier, saves an application mapping after validation, prints its result and exits. Note the returned `record.conversationId`. You can close the terminal or restart the web application. Open a new terminal in this project and run `npm run session -- resume APPLICATION_CONVERSATION_ID` with that actual saved application identifier.

The second process loads the mapping from disk. The record contains the application ID, actual SDK session ID, owned workspace, native configuration location and creation time. It contains no classroom marker or topic. The new prompt asks for the earlier random marker and topic without repeating their values. `options.resume` selects the exact stored SDK conversation and the original native configuration directory locates its persisted transcript.

The worker requires a valid actual init/result identity pair and structured answer. The coordinated demonstration also compares the restored answer exactly with the first worker's observed owned context. It verifies the persisted mapping independently after both processes finish.

## What the browser demonstration restarts

The browser's web coordinator launches the same application worker used by the independent CLI command. It waits for that process to exit before starting a new one. The second worker receives only its operation and saved application identifier as arguments. The coordinator remains running to collect evidence and display the result. The video must identify this as an application-worker restart, not claim that the browser or web coordinator was restarted.

The report captures actual child PIDs, worker-instance identifiers, process spawn/exit timestamps, exit codes, native SDK identifiers, prompts and answers. Instance identifiers are generated inside each process. PID values alone are not treated as proof because operating systems can reuse them. The parent observes the first process's close event before spawning the second.

Fresh mode repeats the actual process exit and relaunch but deliberately omits `resume`. It expects a different native session and unavailable earlier context. A verified fresh control means the expected absence was observed. The same workspace by itself does not choose an earlier conversation.

## Student exercise

Use independent seed and resume commands across two terminal launches. Compare native identifiers and the restored exact marker. Run the fresh control and inspect its different native identity and missing context. Repeat with Hooks. Inspect the saved mapping to confirm that the answer is not embedded there. Keep the owned transcript directory with the mapping; an identifier alone cannot recreate missing conversation history.

The loader validates the requested application ID, verifies the saved record's identity and rejects session locations outside the owned classroom run tree. Tests cover invalid lookup IDs, mismatched records, sibling path escapes and exclusive record creation. This is local classroom storage, not a multi-tenant authorization system or a general-purpose secure file broker.

The original infographic is reused unchanged with provenance. The approved cover retains the instructor photograph and `Author: Luis Coco Enríquez` below it. Narration uses the requested Inworld Yash settings.

Current production verification: source and loader integrity checks pass. Successful native seed/resume verification and recording await the Anthropic credit top-up.

## References

- [Anthropic SDK session persistence and explicit resume](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Anthropic TypeScript SDK query options](https://code.claude.com/docs/en/agent-sdk/typescript)
