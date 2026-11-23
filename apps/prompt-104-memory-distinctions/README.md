# Prompt 104 · Memory distinctions

Author: Luis Coco Enríquez

Demonstrate the differences between project instructions, automatic memory, and session conversation history.

Inspect separate project instructions, automatic memory and native conversation history.

## Run

Use Node.js 22 or later. Extract this folder, run `npm ci`, then `npm start`. Open http://127.0.0.1:43204. `PORT` overrides the port. The app binds to loopback. Select the local experiment or the live model scenario, inspect source, and download the observed report.

Run `npm run agent -- local` for local checks and `npm run agent:live` for actual model calls. Configure `ANTHROPIC_API_KEY` in a local .env or use an existing native Claude login. `CLAUDE_MODEL` overrides the default. Each inference invocation has a $0.75 budget cap and timeout; a multi-call scenario has multiple invocations. Automatic compaction includes a large input and summary requests.

## What is verified

`npm run typecheck` checks TypeScript. `npm test` checks adapter contracts and the local native scenario. `npm run verify:live` actually invokes the model, asserts observed lesson behavior and saves verification-live.json with passed, failed or unavailable status. No mocked model answers are used. A successful local test does not imply a live pass or completed video. Live failures are recorded explicitly.

Fresh owned experiments live under runs/. Native history and temporary authentication files stay there and are excluded from student packages. Reports never include credential files. Do not distribute runs/. Local browser checks use real HTTP routes.

## Student exercise

Identify which facts survive a new session and which require resuming the original conversation.

## Scope and implementation

Read src/lesson.ts for the actual operations, checks and disclosure. The browser shows the same checks and evidence as the CLI. Transcript-only inputs explicitly disable model turns. Live inputs enable them and require actual native completion. The file adapter is for teaching: atomic replace and in-process ordering; same-key writers across processes require a transactional backend or distributed lock. Workspace deployment and transcript persistence are distinct.

The original infographic is copied unchanged and its SHA-256 checked against asset-catalog.json. The approved course cover is reused with instructor portrait and credit. Videos are a separate production step.

## References

- https://code.claude.com/docs/en/agent-sdk/sessions
- https://code.claude.com/docs/en/agent-sdk/session-storage
- https://code.claude.com/docs/en/agent-sdk/typescript
- https://code.claude.com/docs/en/memory

Pinned SDK: 0.3.322. The installed type declarations are the reference for this runnable snapshot.

## Current verification

Source checks, actual local SDK checks, official adapter contract checks and desktop/mobile browser checks passed. Live status: not_run_authentication_required. The native login expired; complete `claude auth login` or configure an API key/token, then run `npm run verify:live`. A successful live model run has not yet been certified.
