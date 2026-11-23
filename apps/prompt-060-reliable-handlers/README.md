# Prompt 60 · Deadlines, cancellation and idempotent API retries

Run actual SDK custom-tool calls against an isolated local HTTP API. Observe a timeout after commit, a same-key replay preserving one booking, host cancellation and a processing deadline.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your own Anthropic API key. Run `npm start` and open `http://127.0.0.1:43160`.

The lesson was verified with Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322 and Zod 4.6.7. Run `npm run typecheck` and `npm test`. Actual CLI examples are `npm run agent -- retry-after-timeout`, `timeout`, `cancel` and `success`. The CLI cancellation case requests host cancellation after the local API admits the request.

## Actual timeout after commit and same-key replay

The default example starts a fresh loopback HTTP service with a synthetic booking API. It initializes the HTTP transport through a readiness probe before measuring the timed tool call. Booking request counters cover the `/bookings` requests.

The first actual request commits its booking after a configured 50 ms and delays its reply by 2500 ms. The handler deadline is 1000 ms. The client returns `TIMEOUT` while the API retains its committed booking. A second actual tool call uses the exact same key and payload with a 2000 ms deadline. The API returns its cached booking with `replayed: true`, preserving one created booking.

Receipts record actual replay state, operation identity, booking identity, reply state and client disconnection. The final agent output is checked against the last actual tool outcome. The report preserves both native tool results, including the first timeout error.

## Application code responsibilities

`src/handler.ts` creates `AbortSignal.timeout()` for the attempt deadline and combines it with the host abort signal using `AbortSignal.any()`. Fetch receives that signal, the classroom body and the request key in its `Idempotency-Key` header. The handler classifies observed host cancellation, deadline expiry and upstream failures into public outcomes.

`src/classroom-api.ts` implements the keyed operation cache, payload fingerprint check, pending-operation sharing and committed booking replay. A changed payload with the same key returns HTTP 409. Concurrent duplicates share one pending operation. A committed entry remains cached when its client disconnects before the delayed reply.

The local fixture cooperatively abandons pending processing when every waiting response disconnects. Client timeout and cancellation describe the client's wait. Recorded API receipts and bookings establish the actual effects for that test run.

The API and cache are in memory and isolated to each experiment. Their state lasts for that local service instance. The example demonstrates client-disconnection recovery within that instance.

## Host cancellation and processing deadline

Select **Host cancellation of pending API call** and run the tool. The cancel button activates after the local API accepts the request. Click it to abort the handler's HTTP fetch. The SDK conversation preserves the actual `CANCELLED` tool outcome and the API records its observed operation and effects.

Cancellation requests include the current control identifier. The app rejects stale identifiers. The SDK query has its own one hundred and fifty second abort, and cancelling this HTTP operation allows the actual handled tool outcome to return through the SDK.

Select **Try processing timeout** for a 250 ms handler deadline and a 1500 ms processing interval. Inspect the native `TIMEOUT`, actual elapsed time, operation phase and effect count. Select **Restore same-key retry** to repeat the commit-before-timeout recovery case.

## Inspect and verify

The panels show actual attempt deadlines and elapsed times, booking API receipts and final structured output. Download the report for full tool arguments, actual request key, attempts, receipts, committed bookings, settled operations, native results, lifecycle provenance and checks.

Unit tests exercise concurrent duplicates, payload conflicts, a deadline after commit, replay without duplicate effects and cooperative pre-commit cancellation followed by a same-key retry. Browser verification exercises every UI scenario, the actual cancel button, a healthy custom-labelled booking, report download, stale cancellation rejection and mobile layout.

The query, MCP server and isolated HTTP service close after the experiment. Reports remain local under `runs/`, and the download index clears on restart. Actual inference requires network access and incurs provider charges. The bookings are synthetic classroom data.

The original infographic and approved author-photo cover are included with provenance.

## References

- [Agent SDK custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [Node.js abort signals](https://nodejs.org/api/globals.html#class-abortsignal)
- [Node.js HTTP server and response lifecycle](https://nodejs.org/api/http.html)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
