# Prompt 86 · Prompt and stop hooks

Author: Luis Coco Enríquez

Validate submitted prompts and completion conditions using supported hooks; prevent recursive stop-hook loops.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43186`. Model calls use your account. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the port.

Run `npm run typecheck` and `npm test` for source checks and the active-stop guard test. Run `npm run agent -- repair-completion MCP` for the native command-line experiment. Other modes are `complete`, `guard-limit` and `reject-prompt`. Topics are `MCP` and `Hooks`.

## Actual supported hook behavior

UserPromptSubmit validates the actual prompt prefix against two supported classroom topics. An unrelated gardening prompt is rejected by the native hook with top-level `decision: 'block'` and a reason. The report records the original submitted prompt and native hook return. Rejection produces no assistant response and no Stop callback.

Stop inspects the actual `last_assistant_message` for a terminal `LESSON_COMPLETE` marker. This is an explicit classroom format check, not a semantic assessment of the explanation. The ordinary repair case starts with a draft missing the marker, receives one native stop-hook block with corrective feedback, and then completes with the marker.

Before requesting another repair, the policy checks `stop_hook_active`. An active continuation is released with an empty hook result. The application records both its final completion condition and its bounded termination outcome, so a released guard cannot silently become a completion claim.

| Case | Prompt admission | Stop events | Actual outcome |
| --- | --- | --- | --- |
| Complete baseline | Admitted | One, inactive | Marker already satisfied |
| Repair completion | Admitted | Inactive then active | One block, corrected marker |
| Guard limit | Admitted | Inactive then active | One block, unmet condition released for manual review |
| Reject prompt | Blocked | None | No assistant response |

The guard-limit case deliberately keeps its fixture completion condition false. It tests a condition that cannot be repaired automatically, and its final outcome must be `manual-review-required`. This demonstrates avoiding recursive stop loops without claiming an incomplete task succeeded. Native maximum-turn, budget and abort bounds provide additional limits, while the active-stop policy itself prevents a second block.

Pinned native runtime 2.1.322 reports the UserPromptSubmit block in a result whose subtype is `success`. Its text explicitly says the operation was blocked by the hook. The application preserves that actual result and verifies rejection through the hook decision, absence of assistant/Stop events and native block text. SDK result subtype alone is not the course completion decision.

## Student exercise

Compare the complete baseline and one-repair case. Inspect both actual stop inputs, their active flags, completion conditions and returned decisions. Run the guard-limit case and confirm the explicit manual-review outcome. Then run an ordinary repair with Hooks and verify the corrected final marker. Extend the prompt policy with another owned classroom topic and test the guard on both satisfied and unsatisfied active continuations.

No native tools are exposed in this text-only lifecycle example. All model calls and recorded hook events are real. Reports preserve original prompts, decisions, stop inputs, assistant responses, native result subtype and actual final text. The source viewer is whitelisted, older results clear during new runs, and credential values are removed before export.

Validated with SDK 0.3.322 and native runtime 2.1.322. The original infographic is reused unchanged with provenance. The approved cover preserves the author's photo and credit. Narration uses the requested Inworld Yash settings.

## References

- [Anthropic UserPromptSubmit control](https://code.claude.com/docs/en/hooks#userpromptsubmit-decision-control)
- [Anthropic Stop input and continuation guard](https://code.claude.com/docs/en/hooks#stop)
- [Anthropic SDK hooks](https://code.claude.com/docs/en/agent-sdk/hooks)
