# Prompt 94 · Continue latest session

Author: Luis Coco Enríquez

Demonstrate continuing the latest session and explain why explicit session selection matters for concurrent users.

## Run the application

Install Node.js 22 or later, extract the project and run `npm ci`, then `npm start`. Open `http://127.0.0.1:43194`. `PORT` overrides the local port. No model credentials are required: the app performs actual native transcript-only operations with assistant turns disabled.

Run `npm run typecheck` and `npm test` for source and actual native selection checks. Run `npm run agent -- shared MCP` for the shared-directory case or `npm run agent -- isolated Hooks` for the directory-scoped control.

## Two interleaved classroom users

Each experiment creates a private owned native configuration and two fresh native sessions. User A is seeded first with its random marker, then User B with a different marker. Shared mode uses one working directory for both users. Isolated mode uses separate working directories while keeping the experiment's private native configuration.

The actual SDK assigns each seed session's identifier. The application captures the native init and result values; it does not generate substitute SDK identifiers. Each user message has a caller-generated prompt UUID so its actual placement in persisted history can be independently checked.

All messages use supported `shouldQuery: false` transcript-only appends. This demonstrates real native session selection and stored context without starting an assistant model turn. The application does not claim that an assistant generated an answer, revealed another user's marker or semantically recalled a previous answer.

## Actual latest versus intended user

The application lists actual eligible sessions for User A's working directory through the SDK before following up. It then submits User A's follow-up with actual `continue: true`. In shared mode, the latest eligible session belongs to User B, so the native initialization/result identify B and the actual follow-up UUID appears in B's history. It does not appear in A's history.

This mismatch is an intentional control. A verified shared case means the actual wrong-session selection was observed, not that implicit routing was correct. The interface labels the route as wrong and separates that observation from the experiment's successful verification.

The repair submits a follow-up with explicit `resume` set to A's captured native identifier. The native init/result must identify A and the actual follow-up UUID must appear in A's history. B's history must remain unchanged by this repair. The original random markers are not repeated in the follow-up prompts.

In isolated mode, the latest eligible session in A's own directory is A's session, so both directory-scoped continue and explicit resume select A. The example demonstrates interleaved logical users rather than simultaneous load testing. It explains why a directory-wide latest assumption is unsuitable when multiple user conversations share that directory.

## Independent native evidence

Fresh reader processes call actual `listSessions()` and `getSessionMessages()` after seed, implicit continue and explicit repair. The UI lets students inspect the actual stored contexts at each stage. The report preserves native identifiers, prompt UUIDs, actual eligible session ordering, complete native events, snapshots and individual checks.

Every native append must complete with matching init/result IDs, zero assistant turns, zero model cost and zero API duration. Original context markers must remain separate before the routing test. An unrelated original marker is not inserted into a follow-up to fake continuity. This is a session-storage and selection demonstration, not a model-answer benchmark.

In this pinned runtime, resuming pending transcript-only context adds a stored assistant-role `No response requested.` placeholder. The viewer preserves and labels actual message roles. This native placeholder is not a model-generated answer; actual streamed completion reports zero assistant model turns, zero API duration and zero cost.

These are fixed owned local classroom users. No authentication or authorization service is implemented. Explicit resume selects a particular native session; a real application separately associates that identifier with its authenticated user's conversation record.

## Student exercise

Run shared mode and compare the actual latest native identifier with User A's intended session. Inspect where the actual follow-up UUID was stored. Compare the explicit repair and B's unchanged history afterward. Run isolated mode and explain the different latest-session result. Repeat with Hooks and new random context markers. Distinguish native selection, stored context, application ownership and generated assistant answers.

Generated histories and run reports are excluded from the student package. Source viewing is whitelisted and exported report content removes credential values. The original infographic is reused unchanged with provenance. The approved cover retains the instructor photo and `Author: Luis Coco Enríquez` below it. Narration uses the requested Inworld Yash settings with cube transitions and timed focus rectangles.

## References

- [Anthropic continue, resume and session selection](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Anthropic TypeScript session utilities and transcript-only messages](https://code.claude.com/docs/en/agent-sdk/typescript)
