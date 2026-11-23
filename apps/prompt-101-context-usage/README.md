# Prompt 101 · Context usage

Author: Luis Coco Enríquez

Inspect supported context-usage information and identify the largest contributors to the context window.

## Run the application

Install Node.js 22 or later, extract the project and run `npm ci`, then `npm start`. Open `http://127.0.0.1:43201`. `PORT` overrides the local port. This lesson runs actual local SDK context commands without assistant inference; no API key is required.

Run `npm run typecheck` and `npm test` for source, ranking semantics and actual native context measurements. Run `npm run agent -- compare MCP` for all profiles, or choose `baseline`, `short` or `long` and either `MCP` or `Hooks`.

## Actual supported context_usage reports

Each profile creates a fresh owned workspace and native configuration. Baseline starts without an appended dataset. Short and long profiles append 12 or 160 numbered owned synthetic classroom records using actual `shouldQuery: false` native messages. The local `/context` command then explicitly resumes that captured native session and returns its actual report.

The installed SDK exposes the structured `context_usage` value on the native local-command assistant packet. The application requires that actual field, validates its supported shape and preserves both the original structured data and actual native markdown command output. It does not estimate tokens with its own tokenizer or fabricate a ledger to resemble an SDK report.

The packet is a native computed local-command report with model `<synthetic>`, not a model-generated assistant answer. Every native operation must complete successfully with matching init/result identities, zero assistant model turns, zero model cost and zero API duration. These profiles begin with no prior paid history, so their reported session cost is also zero.

## Used, reserved and free categories

The native structure supplies `total_tokens`, `raw_max_tokens`, categories and category kinds. The application preserves the reported model and capacity rather than assuming a universal fixed context-window size. Its budget chart uses actual native token counts for each returned category. Chart percentages are derived from those counts; a native top-line percentage can be rounded differently.

Only categories with kind `used` participate in the largest-used-contributor ranking. The larger free-space and autocompact-buffer components remain visible in the budget composition and are not mislabelled as consumed message context. Baseline can return no used category; the UI says none reported rather than inventing one.

The comparison chart plots actual used-token totals for the observed profiles, scaled against the largest measured used total in that experiment. It is explicitly labelled with that comparison scale and is separate from the full-window budget chart. Increasing the owned transcript volume must increase the native estimated total in this controlled comparison.

## Scope of the measurements

The native command labels its category figures as estimated usage. This lesson measures fresh transcript-only histories without executing the first model inference turn. In the pinned runtime these reports show loaded message estimates plus reserved buffer and free capacity. Only categories actually returned by the command are displayed. Missing tool, instruction or memory categories are not presented as measured zero overhead for a full agent inference prompt.

The report's native tool, memory-file and agent fields remain in the raw structured output when returned. This is not a full inference-prompt benchmark or provider billing-token measurement. The lesson demonstrates how to inspect supported native information and interpret its reported scope before using it for application decisions.

## Verification and student exercise

Native checks require the local context command identity, actual structured report, matching session identities and zero-turn completion. Used-category totals must match the native total, and used/reserved/free token components must account for the reported window. Ranking must exclude free and reserved kinds. The unit ranking fixture deliberately gives free space and reserve more tokens than used categories to exercise that distinction. Native integration checks measure increasing owned history through the actual command.

Browser checks execute all profiles and an alternate topic, compare SVG chart values with native tokens, verify budget geometry, profile selection, raw command text, report download, invalid input, source allowlisting, original assets and mobile width.

For your exercise, compare baseline, short and long Hooks histories. Inspect actual estimated used tokens and the largest reported used category. Select the baseline again and compare free/reserved capacity with the longer history. Inspect the raw native field names and command text. Explain why reserved capacity, used context, a full inference prompt and billed input tokens are different measurements.

Generated native histories, local reports and exploratory probes are excluded from the student package. Source viewing is whitelisted and report exports remove credential values. The original infographic is reused unchanged with provenance. The approved cover retains the instructor portrait and `Author: Luis Coco Enríquez` below it. Narration uses the requested Inworld Yash settings with cube transitions and timed red highlights.

## References

- [Anthropic TypeScript SDK context_usage and local context report](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Anthropic session conversation history](https://code.claude.com/docs/en/agent-sdk/sessions)
