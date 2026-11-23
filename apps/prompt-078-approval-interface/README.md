# Prompt 78 · Approval interface

Author: Luis Coco Enríquez

Build an approval interface that associates requests with the correct user and session and handles disconnection.

## Run the application

Install Node.js 22 or later. Extract this project into its own directory, run `npm ci`, set `ANTHROPIC_API_KEY` in your local process environment and run `npm start`. Open `http://127.0.0.1:43178`. The default model is `claude-sonnet-4-6`. You can set `CLAUDE_MODEL` and `PORT` locally.

Choose Classroom Learner A and start an actual Write request. Inspect the pending native tool name, arguments, tool use identifier and SDK session identifier. Approve, deny or revise the text. An approved Write is followed by an actual native Read, and the host independently checks the complete file text.

Run `npm run typecheck` and `npm test` to check the source and session authorization. `npm run agent -- revise MCP` runs the native approval workflow through the command line. The browser supplies the user and application-session authorization layer.

## User and session association

The identity selector is a fixed local classroom fixture with two synthetic learners. Selecting a learner issues a random opaque HttpOnly, SameSite Strict cookie with a one-hour lifetime. The server stores its SHA-256 lookup key. A separate public UUID identifies the application session in the interface and evidence.

Each run has an owner containing both the classroom user identifier and the application-session identifier. Every job read, answer, cancellation and report download checks both values. A second browser context signed in as the same learner receives a different session and cannot access the original run. Foreign runs return HTTP 404. Requests without a valid cookie return HTTP 401.

The actual SDK session identifier is captured from the native initialization message and included in the pending callback payload. Verification compares it with the completed native session. It also matches the actual tool use identifier, callback decision, native Write/Read results and independently read file contents.

The recorded outcome uses the independently read file text. `modelOutput` preserves the model's final structured summary, and `modelEchoExact` reports whether it copied that text exactly. A real Unicode revision test preserved curly quotation marks in the native file while the model restated them as straight quotes. The interface retains both versions. Verification requires the actual file to match the effective approved input exactly and requires the model's completion status to agree with the native outcome.

## Disconnection and cancellation

The native query and pending question live in server memory. Refreshing the page with the same valid cookie restores that session's current request. A temporary browser network interruption leaves its pending identifier intact. Polling retries with bounded backoff, and the interface preserves an in-progress revision draft while reconnecting. Invalid answers preserve the question so the learner can correct them. Stale answers return HTTP 409.

Ending the classroom session revokes its cookie and cancels its active native query. The interface clears prior question text, results and download links. Starting another session creates a new owner scope. Restarting this classroom server clears its in-memory sessions and jobs. The example demonstrates browser-connection recovery while the server process remains alive.

Each model run uses a fresh disposable workspace with only native Read and Write exposed. A path/input hook limits operations to the owned classroom note. The sample's 360-second run deadline also bounds an unanswered approval.

## Reproduce the lesson

1. Open separate browser contexts for Learner A, Learner B and a second Learner A session.
2. Start a request in the first A session and copy its public run UUID.
3. Try opening that UUID in B and the second A session. Inspect the actual HTTP 404 feedback.
4. Return to the original A session and refresh. Confirm the same pending question and native SDK session.
5. Temporarily disconnect the browser, type a revision, reconnect and submit it. Verify the actual file and native results.
6. Download the observed report. End the session and confirm a new session cannot open its former runs.

The bundled original infographic is reused unchanged. Its provenance file records the source and hash. The cover follows the approved course artwork and places the author credit below the photograph. Credentials are supplied locally through environment variables.

The lesson uses TypeScript SDK 0.3.322 with its bundled native runtime. The identity provider and classroom note are local teaching fixtures. Native model calls, pending callbacks and file operations are real. The video includes AI-generated Inworld Yash narration and timed focus highlights.

## References

- [Anthropic user-input and approval callbacks](https://code.claude.com/docs/en/agent-sdk/user-input)
- [Anthropic session identifiers and persistence](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Anthropic TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)
