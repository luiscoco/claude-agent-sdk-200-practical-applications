# Prompt 56 · Rich tool results with an embedded JSON resource

Return text, an embedded resource and structured data through an actual custom-tool callback. This runnable example follows the resource option in Prompt 56 and uses a synthetic classroom JSON fixture.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your own Anthropic API key locally. Run `npm start` and open `http://127.0.0.1:43156`.

The lesson was verified with Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322 and Zod 4.6.7. Run `npm run typecheck` and `npm test`. Use `npm run agent -- available` or `npm run agent -- missing` for actual CLI queries.

## Actual rich-result flow

`src/pack.ts` reads `fixtures/lesson-pack.json`, validates its document and builds an embedded resource object containing `uri`, `mimeType` and serialized `text`. The callback's `content` array contains a text summary and a `resource` block. Its `structuredContent` field supplies the machine-readable summary.

The synthetic fixture contains a sample title and three section strings. The summary includes lesson number, title, section count, resource URI and SHA-256 digest of the exact resource text. The callback records its actual block types, resource object, outcome and process identifier.

In the observed pinned SDK representation, the embedded resource becomes a native text block prefixed with `[Resource from lessons at course://lessons/56/outline]`. Another native text block contains the summary. The successful SDK user message preserves `structuredContent` in `tool_use_result` metadata.

The app preserves those actual native blocks and validates the converted resource body. Checks compare its URI and exact text hash with the recorded handler summary. They also compare native summary, successful structured metadata and final agent structured output. The final agent output uses a separately configured SDK output schema.

The `course://` URI identifies the embedded content. The resource body is supplied directly in the tool result. The actual callback MIME type is retained in the handler evidence. The observed converted native text is retained in the native evidence.

## Missing pack and recovery

Select **Try missing pack** and call the tool. The actual callback attempts to read the selected missing fixture path, observes `ENOENT` and returns `PACK_NOT_FOUND` with its tool error flag. The response has no embedded resource. The native result and final agent output preserve the failed outcome.

Select **Restore available pack** and run a fresh actual query. Text and resource content, native conversion, structured metadata and resource hash verification return successfully.

## Edit and inspect

Add a section to the local JSON fixture, rerun the available pack and compare the actual resource body, section count and digest. Browser verification exercises this edit through a real SDK call and restores the original fixture afterward.

The three panels show callback metadata, the converted native resource and actual structured metadata. Expand preserved evidence or download the report for complete callback resource data, native blocks, lifecycle events, parsed resource and final structured output. The native hook identifies the lessons server with source `sdk`.

The query and in-process server close after consumption, and a ninety-second abort bounds the experiment. Reports remain local under `runs/`, and the in-memory download index clears on restart. Actual inference requires network access and incurs provider charges.

The original infographic and approved author-photo cover are included as local application and video assets with provenance. The custom tool sends the synthetic classroom JSON resource during inference.

## References

- [Agent SDK rich content and structured tool results](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- Actual native user messages and lifecycle metadata observed with the pinned SDK.

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
