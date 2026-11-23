# Prompt 90 · Hook reliability

Author: Luis Coco Enríquez

Configure matchers, timeouts, and fail-closed behavior; demonstrate why asynchronous hooks cannot enforce blocking decisions.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43190`. Native model calls use your account. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the local port.

Run `npm run typecheck` and `npm test` for source checks and meaningful deadline cancellation/listener-cleanup coverage. Run `npm run agent -- throw-closed MCP` for a native CLI experiment. The other modes are listed below, with `MCP` and `Hooks` as supported topics.

## Six actual native reliability experiments

Each experiment starts in a fresh owned workspace. One preapproved native MCP `save` request can create only that workspace's synthetic note. The host independently inspects whether the file exists and contains the expected note. Handler counts, native results and actual final model text must agree.

| Mode | Actual guard behavior | Handler runs | Owned file |
| --- | --- | --- | --- |
| matcher-miss | Matcher targets another tool, so callback never runs | Once | Created |
| deny | Matching synchronous pre-tool denial | Never | Absent |
| throw-open | Callback throws; onFailure continue | Once | Created |
| throw-closed | Callback throws; onFailure block | Never | Absent |
| timeout-closed | One-second matcher timeout cancels a 2.5-second callback wait | Never | Absent |
| async-audit | Callback returns async output; advisory audit completes later | Once | Created before audit finishes |

The matcher uses the real native MCP tool name. The missed-matcher case proves that registering a denial callback is insufficient if its filter never selects the actual operation. Every case preserves actual tool-use identifiers and callback observations.

Thrown callbacks produce an actual `hook_callback_failed` informational warning. `onFailure: 'continue'` leaves the call to its normal permission flow, which is preapproved here. `onFailure: 'block'` prevents execution. This field requires a sufficiently recent SDK/runtime; the course validates it under SDK 0.3.322 and native 2.1.322. The application does not catch its deliberate guard exception and turn it into an empty successful return.

## Native deadlines and cancellation

The timeout experiment sets the matcher timeout to one second while its callback waits for 2.5 seconds. Native deadline cancellation reaches the callback's actual AbortSignal. The helper clears its timer, removes the listener and rejects the wait. The native result blocks the tool, and independent inspection confirms no file was created.

The meaningful test covers an already-aborted signal, in-flight cancellation and a signal aborted after a successful wait. A completed wait must remove its listener so a later abort cannot produce a spurious cancellation. The native experiment separately verifies the real runtime deadline and blocked tool execution.

## Why the asynchronous audit cannot be the guard

The async case starts a bounded background audit and returns `{ async: true, asyncTimeout: 10000 }` immediately. The native save proceeds. The later host audit records that it would have denied the operation and independently observes that the file already exists. Its recommendation is explicitly advisory evidence, not a native permission decision returned after the fact.

Actual recorded timing must show async return, handler save and background audit in that order. This demonstrates that the asynchronous side effect cannot prevent an operation already executed. Enforcement belongs in a synchronous pre-tool decision, with an appropriate matcher, timeout and failure policy. Background logs or metrics may be asynchronous.

## Student exercise

Compare missed and matching guards, then the continue and block failure policies. Inspect the native warning and actual owned-file evidence. Run the deadline case and locate its real cancellation event. Run the async audit and compare actual timestamps and file presence. Repair enforcement by selecting the synchronous deny case with Hooks in a fresh workspace; verify that new owned file stays absent.

Reports preserve actual callback configuration, native calls/results, informational warnings, callback/execution timing and independent file evidence. No automatic retries are made. Old results clear while a new run executes, source files are whitelisted, downloads contain observed records and credential values are removed before export.

All tool calls, callback failures, native deadlines and model responses are real. Only the owned note and audit recommendation are classroom fixtures. The original infographic is reused unchanged with provenance. The approved cover preserves the author's photo and credit. Narration uses the requested Inworld Yash settings.

## References

- [Anthropic SDK matchers and timeouts](https://code.claude.com/docs/en/agent-sdk/hooks#matchers)
- [Anthropic fail-closed callbacks](https://code.claude.com/docs/en/agent-sdk/hooks#block-the-action-when-a-callback-fails)
- [Anthropic asynchronous callback limits](https://code.claude.com/docs/en/agent-sdk/hooks#asynchronous-output)
- [Anthropic native hook timeouts](https://code.claude.com/docs/en/agent-sdk/hooks#hook-timeout)
