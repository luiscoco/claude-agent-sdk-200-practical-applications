# Prompt 79 · Deferred approval

Author: Luis Coco Enríquez

Defer a sensitive tool call using the supported hook decision, stop the worker, and resume after approval.

## Run the application

Install Node.js 22 or later. Extract the project, run `npm ci`, set `ANTHROPIC_API_KEY` in your local process environment and run `npm start`. Open `http://127.0.0.1:43179`. You can set `CLAUDE_MODEL` and `PORT` locally. The default model is `claude-sonnet-4-6`.

Choose MCP or Hooks and click **Defer actual Write**. Inspect the actual `tool_deferred` result, original native call and stopped worker. Choose approve or deny and click **Resume saved native session**. Inspect the replayed native tool identifier, the fresh worker and the actual file outcome.

Run `npm run typecheck` and `npm test` for source and worker-lock checks.

## Run across separate command-line processes

```powershell
npm run agent -- defer MCP
```

Copy the returned public run UUID, then start a second command after reviewing the original call.

```powershell
npm run agent -- resume YOUR-RUN-UUID approve
```

Use `deny` for a second fresh deferred request to observe the actual native denial and absent file. Completed requests reject a second resume.

## Actual deferral and replay

The first worker exposes native Write and Read for a synthetic owned classroom note. Its `PreToolUse` hook validates the exact file path and content and returns `permissionDecision: 'defer'`. The actual SDK result supplies `stop_reason: 'tool_deferred'` and `deferred_tool_use` with its original identifier, name and input. Verification requires an absent output file and an actual persisted native transcript.

After that result, the application closes the query and waits for the actual native child process to exit. It records the real process identifier and exit status. A saved JSON state retains the original call and native session identifier while the worker is stopped. Credentials are supplied to the process environment and excluded from the saved classroom state and exported reports.

Resumption calls `query()` with the saved `resume` identifier, the same owned working directory and native configuration directory, and session persistence enabled. A new worker replays the pending call through the observed native approval path. The hook and host permission callback both require the original native tool use identifier and exact arguments before returning the operator's allow or deny decision. Approved execution is followed by native Read and an independent host read of the complete file. The verifier checks both worker exits, session continuity, exact replay identifier, native tool result and actual file text.

In one actual replay under the pinned runtime, the pending Write reached the host permission callback before the SDK hook ran. The host callback therefore applies the same exact native tool identifier and input check before allowing the selected approval. Hook and callback events are preserved separately, and the interface labels the observed decision source. Initial deferral always requires the actual `PreToolUse` defer event. Resume verification requires an observed matching hook or callback decision plus the original native Write result and exact file outcome.

The native runtime can repeat a permission callback for the same replay identifier. The callback returns the same owner decision for that exact identifier and input each time. The report preserves every observed callback and verifies their consistency.

The SDK's Read preapproval covers the owned verification read. The path hook still rejects other paths and additional operations. Its SDK shadowing warning describes that Read preapproval. The Write decision is supplied by the exact replay hook.

## Persistence and recovery exercise

Defer a request, copy its run UUID, refresh the browser or restart this local server, and load the UUID through **Load saved state**. The state and native transcript are stored under this project's `runs` directory. Once the verified deferral has finished, a server restart can restore it and launch a fresh resume worker.

The file lock prevents two local workers from operating on the same saved run concurrently. A lock owned by a terminated host process can be reclaimed. Invalid or completed states reject resumption. If a host is interrupted during an active deferral or resumption, inspect that run's state and transcript before starting a new classroom run. The interface restores verified completed deferrals.

This is a local single-operator classroom interface. The sensitive action is represented by an owned synthetic note. Its native SDK calls, stopped workers, persisted transcript and replay are real. The bundled original infographic is reused unchanged with its recorded provenance. The approved cover includes the author's photo and credit below it. Video narration uses Inworld Yash with the approved course settings.

## References

- [Anthropic defer and replay behavior](https://code.claude.com/docs/en/hooks#defer-a-tool-call-for-later)
- [Anthropic SDK hook outputs](https://code.claude.com/docs/en/agent-sdk/hooks)
- [Anthropic session persistence and resume](https://code.claude.com/docs/en/agent-sdk/sessions)
