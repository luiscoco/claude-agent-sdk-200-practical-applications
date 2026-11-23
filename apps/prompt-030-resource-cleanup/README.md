# Prompt 30 · Resource cleanup

Implement cleanup after successful completion, cancellation, and an application exception, then verify the actual SDK subprocess has stopped.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43130. Run `npm run agent` to compare all three scenarios, or append `-- success`, `-- cancel`, or `-- exception` to select one. Run `npm run typecheck` and `npm test` for the offline checks.

## Track a real native subprocess

The supported spawnClaudeCodeProcess option delegates local spawning to ProcessTracker. It forwards the SDK-provided command, arguments, working directory, environment, and graceful-close forwarding signal to Node's spawn. These environment values are passed directly to the child. Reports preserve process lifecycle observations and omit the environment and arguments.

The tracker records the actual child PID, confirms that it exists when spawned, and observes the child's close event with exit code or signal. Finally, isProcessAlive probes the same PID with process.kill(pid, 0). An ESRCH result means that PID is absent. Other probe errors propagate. Verification requires that the process started alive, its close event was observed, and its PID is absent after cleanup.

## Three real exit paths

- Success sends a real query that returns exactly 4 and verifies its successful result.
- Cancellation enables partial messages, waits for an actual text delta from a request to print integers, and calls AbortController.abort(). The recorded runtime reported Operation aborted. The actual streamed prefix is preserved.
- Exception throws the deliberately named CLASSROOM_APP_EXCEPTION after actual SDK initialization. The application catches and preserves its own exception diagnostic.

All three paths execute the same finally block, clear the timeout, call query.close(), and verify the subprocess. A query-close exception is recorded while process verification still runs. If the tracked child fails to close within five seconds, the application requests SIGKILL on its own child handle and waits another five seconds. applicationFallbackKill records that application fallback. The exit signal separately reports how the actual process ended, including any SDK-initiated termination.

The live CLI and browser checks verified all three scenarios. Each actual PID was absent after cleanup. Cancellation produced a SIGKILL exit signal in the CLI run. The application's fallback kill was unused in that run. Exit details are preserved per experiment.

Each query has a 90-second abort timeout, a one-turn agent-loop limit, and a USD 0.30 SDK budget limit. Built-in tools, MCP servers, and filesystem setting sources are empty. The server runs one experiment at a time. Reports are saved under runs and downloadable from the interface.

## Recovery and exercise

After observing the deliberate application exception, restore the success scenario and run a fresh query. Confirm the actual answer and stopped PID. Compare all three exit paths again, inspect their events, and independently check the reported PIDs after the run. Distinguish the cancellation request, finally block, close event, exit signal, and PID probe in the saved observations.

The original infographic and branded photo cover are reused. Author: Luis Coco Enríquez.

## References

- [TypeScript SDK process spawning and query options](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Node.js child process lifecycle](https://nodejs.org/api/child_process.html)
- [Node.js process.kill](https://nodejs.org/api/process.html#processkillpid-signal)
