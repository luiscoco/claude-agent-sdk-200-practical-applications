# Prompt 98 · Resume boundaries

Author: Luis Coco Enríquez

Resume from a supported message boundary and demonstrate exactly which earlier conversation context is retained.

## Run the application

Install Node.js 22 or later, extract the project and run `npm ci`, then `npm start`. Open `http://127.0.0.1:43198`. `PORT` overrides the local port. No model credentials are required: this application uses actual native transcript-only operations with assistant inference disabled.

Run `npm run typecheck` and `npm test` for source and actual native boundary checks. Run `npm run agent -- first MCP`, `npm run agent -- second Hooks` or `npm run agent -- full MCP` for the native CLI cases.

## Fresh native history and real supported UUIDs

The application creates one native session with three successive owned classroom contexts. Each includes a different random marker. The first append starts a fresh native session; subsequent appends explicitly resume its captured SDK identifier. All input messages use supported `shouldQuery: false`, so they append actual history without starting an assistant model turn.

The pinned native runtime inserts stored assistant-role `No response requested.` placeholders when loading pending transcript-only context. These are native transcript entries, not model-generated answers. The application retrieves the actual sequence with SDK `getSessionMessages()`, then chooses the first or second observed assistant-entry UUID as a supported boundary. It does not invent a message identifier or pretend that the placeholder is an AI response.

## Actual resumeSessionAt and forkSession options

The new query supplies the actual source identifier as `resume`, sets `forkSession: true` and, for a bounded case, supplies the selected native UUID as `resumeSessionAt`. The fork gets a distinct actual native identifier. Forking keeps the selected conversation separate from the original source's later user context.

The first boundary retains the first original context and its native placeholder. The second retains the first two contexts and their placeholders. Full mode deliberately omits `resumeSessionAt` and keeps all three original contexts. The new follow-up prompt does not restate any original random marker values.

After native completion, a fresh reader process retrieves source and fork histories. The actual fork's initial UUIDs, roles and message payloads must match the exact selected source prefix. Its retained original markers must match the selected case. The actual new follow-up UUID must appear in the fork and remain absent from the source conversation.

## What is preserved and what is not rewound

All three original markers must remain in the original source, and its original user-message context must remain unchanged. The full native message hash is also reported as an observation, separately from the user-context check, so native placeholder/metadata behavior is not silently normalized away. The actual raw fork file's marker presence is reported alongside the SDK's active conversation history.

A separate labelled host-created note is written after the third context. It must remain at that latest filesystem state after either earlier boundary is selected. The note is a classroom scope control, not a file written by a model. Conversation boundary resume is not file-checkpoint rewind.

Every native run must complete successfully with matching init/result identities, zero assistant turns, zero model cost and zero API duration. This lesson demonstrates which native conversation records are retained. It does not claim that a fresh assistant semantically recalled the retained data or generated a new answer.

## Independent checks and student exercise

The native integration test executes both actual boundaries and a full-history control. It verifies exact retained prefixes, expected original markers, distinct native fork identity, preserved source user context and the separate file state. Browser checks execute all modes, another topic, actual message displays, report download, invalid input, source allowlisting, original assets and mobile width.

For your exercise, compare the first and second boundaries using Hooks. Inspect the actual native boundary UUID, source prefix and retained marker table. Compare with full mode. Check the original source's third marker and the separate host note afterward. Explain the difference between selecting a conversation boundary, forking native history, generating an assistant answer and rewinding filesystem changes.

This is an owned local classroom application rather than a multi-user authorization service. Generated run histories and exploratory probe evidence are excluded from the student project. Source viewing is whitelisted and report exports remove credential values.

The original infographic is reused unchanged with provenance. The approved cover retains the instructor portrait and `Author: Luis Coco Enríquez` below it. Narration uses the requested Inworld Yash settings with cube transitions and timed red focus rectangles.

## References

- [Anthropic TypeScript resumeSessionAt and forkSession query options](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Anthropic session history, forking and filesystem distinction](https://code.claude.com/docs/en/agent-sdk/sessions)
