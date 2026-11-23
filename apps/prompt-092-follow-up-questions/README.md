# Prompt 92 · Follow-up questions

Author: Luis Coco Enríquez

Ask several related questions in one conversation and verify that earlier context remains available.

## Run the application

Install Node.js 22 or later, extract the project and run `npm ci`. Configure `ANTHROPIC_API_KEY` in your local process environment, then run `npm start` and open `http://127.0.0.1:43192`. Actual model calls use your account. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the local port.

Run `npm run typecheck` and `npm test` for source and retained-requirement comparison checks. Run `npm run agent -- resume MCP` for the three-query native comparison, or use `fresh` to start a separate conversation for each question. Topics are `MCP` and `Hooks`.

## Establish, recall and apply

The application generates an owned synthetic classroom plan with a random marker, the selected topic and two requirements selected from four classroom constraints. Only the first question supplies these exact values. The second asks to recall them; the third asks to use the same plan and suggest one brief next step. Their prompts do not repeat the random marker or the selected requirement values.

Each answer uses a structured schema containing context availability, marker, topic, requirements and a next step. The schema lists the possible requirement names, but does not reveal which two were selected or the random marker. Checks compare exact values against the original plan, allow requirement order changes and reject duplicates, missing requirements and foreign requirements. A nonempty next step is checked for presence; the application does not claim to automatically grade its educational quality or semantic consistency.

## Resume versus fresh conversations

Resume mode captures the first actual `session_id` from the SDK initialization message. The next two `query()` calls explicitly pass that identifier in `options.resume`, using the same owned workspace and native configuration location. All three native initialization and result identifiers must agree with that selected session. The exact original plan must appear in each structured answer.

Fresh mode deliberately omits `resume` on every query. It expects three different native conversations. Later queries have no earlier plan, so the instructions require `contextAvailable: false`, null marker/topic and empty requirements. This is an intentional context-loss control. A verified fresh run means this expected absence was observed, not that earlier context was retained.

The report preserves actual prompts, requested resume identifiers, native init/result IDs, raw native result text, validated structured answers and individual checks. No native file tools are exposed. Answers appear only after actual queries; the initial interface does not display fabricated successful results.

## Student exercise

Run resume mode and compare the three native session IDs and exact marker. Inspect the actual follow-up prompts to confirm the values are omitted. Run fresh mode and inspect the intentional loss of earlier context. Repeat resume with Hooks and compare a newly generated plan. Explain why passing the same working directory alone does not select an earlier conversation.

Native transcripts remain in the owned `runs` directories. Source viewing is whitelisted, report exports remove credential values and prior UI results clear while a new run executes. This is a local classroom application rather than a multi-user conversation authorization system.

The original infographic is reused unchanged with SHA provenance. The approved cover retains the instructor portrait, Claude icon and `Author: Luis Coco Enríquez` below the portrait. Video production uses the requested Inworld Yash settings, timed focus rectangles and cube transitions.

Current production verification: source type checking and the retained-requirement unit check pass. Live native verification and application recordings await the Anthropic credit top-up. Preparation does not imply that the native comparisons have passed.

## References

- [Anthropic SDK session management](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Anthropic TypeScript SDK query options](https://code.claude.com/docs/en/agent-sdk/typescript)
