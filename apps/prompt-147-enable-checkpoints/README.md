# Prompt 147 · Enable checkpoints

Author: Luis Coco Enríquez

Enable file checkpointing and capture the user-message identifiers needed for restoration.

## Run

Use Node.js 22 or later. Run `npm ci`, then `npm start`. Open http://127.0.0.1:43247. `PORT` overrides the local port. The browser includes an experiment, source viewer, original infographic, cover and observed-report download.

`npm run agent -- local` runs the actual local native scenario. `npm run agent:live` runs the real model scenario. For live use, configure a replacement `ANTHROPIC_API_KEY` locally or use a valid native login. No credentials are included.

## Verification

Run `npm run typecheck` and `npm test`. The integration test inspects actual SDK discovery/control responses. It does not substitute a mocked inventory. Local mode makes no assistant inference turn and is not a live-model pass.

Run `npm run verify:live` for real model verification. It writes a passed, failed or unavailable result to verification-live.json. Each inference invocation is bounded by a $0.75 cost limit, turn limit and timeout, unless the lesson sets a lower limit; multi-query experiments make multiple invocations. Prompt 120 uses a $0.35 aggregate query cap.

Read src/lesson.ts for the exact feature-specific checks, fixture inputs and measurement scope. Missing task events, missing required tool calls or incorrect facts fail live checks. Actual responses, lifecycle events and usage stay in the observed evidence. No generated model output is hard-coded as a claimed live result.

## Exercise

Change one owned fixture or configuration in src/lesson.ts, rerun the local experiment, then compare the live result. Explain which behavior was established by local discovery and which needed actual inference. Inspect failed checks before changing the expected outcome.

## Files and scope

Exercise actual local runtime controls and owned fixtures. Live mode verifies the corresponding model/tool behavior with native evidence. Local success does not certify live inference.

- src/lesson.ts: operations and observed checks specific to this prompt.
- src/capabilities.ts: native discovery and control requests on a held-open input stream.
- src/agents.ts: specialist definitions, owned document and event helpers.
- src/extensions.ts: owned skill/plugin fixture creation.
- src/native.ts: bounded native query collection.
- src/launch.ts and src/worker.ts: isolated experiment process and native configuration.

Only owned classroom files under runs/ are created or modified. Those generated directories, temporary login files and reports are excluded from student packages. The application is a loopback teaching server, not a hosted multi-tenant product. The source viewer is allowlisted.

Pinned SDK: 0.3.322. Unsupported capabilities are disclosed or fail explicit checks. Do not infer that the presence of a CLI feature proves support in another SDK language. Videos are a separate production step.

The original lesson infographic is copied unchanged with its SHA-256 provenance. The approved course cover preserves the instructor portrait and attribution.

## References

- https://code.claude.com/docs/en/agent-sdk/subagents
- https://code.claude.com/docs/en/agent-sdk/skills
- https://code.claude.com/docs/en/agent-sdk/plugins
- https://code.claude.com/docs/en/agent-sdk/typescript

Additional references: https://code.claude.com/docs/en/agent-sdk/typescript and https://code.claude.com/docs/en/agent-sdk/file-checkpointing


## Current verification

TypeScript, actual local SDK/control checks and desktop/mobile browser checks passed. Live-model behavior remains unverified: replacement credentials must be configured locally. The exposed chat key was not used. Run `npm run verify:live` after setting a replacement key to obtain an actual passed/failed report.
