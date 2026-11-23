# Prompt 91 · Capture session IDs

Author: Luis Coco Enríquez

Capture a session identifier and associate it with an application conversation record.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43191`. Native model calls use your account. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the local port.

Run `npm run typecheck` and `npm test` for source and concurrent-mapping integrity checks. Run `npm run agent -- single MCP` for a native CLI capture, or use `pair` to create two distinct conversations. Topics are `MCP` and `Hooks`.

## Two identifiers with different roles

The host generates the application `conversationId`. The SDK supplies its own native `session_id` in actual system initialization and result messages. The application treats that native value as an opaque string; it does not manufacture an SDK identifier or assume its format is always a UUID.

The stream loop captures the actual initialization and result identifiers and requires them to agree. Only after the native query succeeds, its structured topic matches the selected classroom topic and its identity is valid does the application create a persisted conversation record. The record stores the application ID, captured SDK ID, topic, actual model summary, timestamps and the owned workspace/configuration location needed to locate that session later.

The model summarizes a supplied short classroom fact about MCP or Hooks. These are owned educational fixtures. No native tools are exposed in this identity example. The topic/summary result is structured and validated, while the raw native result remains in the evidence.

## Verify persisted mappings

Single mode creates one application conversation. Pair mode creates two actual native sessions with separate application IDs and different classroom topics. The report requires both application and SDK identifiers to be distinct across the pair. Select either captured record and use the lookup button to independently load its saved JSON through the application conversation ID.

Each record is inserted with exclusive creation. Pair mode deliberately attempts to rebind the first application conversation to the second actual SDK session. That insertion must fail with `EEXIST`, and rereading the original record must confirm its native binding stayed unchanged. This is a mapping integrity control using two real captured sessions, not a fabricated foreign identifier.

The meaningful concurrency test attempts two competing inserts for the same application ID. Exactly one may succeed; the rejected insert must not replace the successful native binding. Invalid application lookup IDs are rejected before constructing a record path. The SDK session identifier remains opaque inside the validated application record.

## Student exercise

Capture one conversation and compare the actual init and result IDs with its saved mapping. Capture a pair, select the second record and load it from disk. Inspect the deliberate wrong-session rebind rejection. Repeat with Hooks and compare the new application and native identifiers. Keep application identity, native conversation identity and storage location separate when preparing later resume workflows.

This is a local single-user classroom store, not a multi-tenant authentication example. Native transcripts and application records are stored in owned run directories. Source files are whitelisted, prior results clear while a new run executes, and report exports remove credential values. A failed native query does not create a successful conversation record.

The original infographic is reused unchanged with provenance. The approved cover preserves the author's photo and credit. The production workflow uses the requested Inworld Yash narration.

Current production verification: source type checking, the concurrent mapping test and static browser checks pass. Live native verification is pending the Anthropic credit top-up; the recorded credit failure is not marked as a successful capture.

## References

- [Anthropic SDK session identifiers and resume](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Anthropic TypeScript system and result messages](https://code.claude.com/docs/en/agent-sdk/typescript)
