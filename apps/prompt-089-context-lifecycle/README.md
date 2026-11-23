# Prompt 89 · Context lifecycle

Author: Luis Coco Enríquez

Observe compaction and model-switch lifecycle events where supported and record their effects.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43189`. Native model calls use your account. The initial model defaults to `claude-sonnet-4-6` and can be overridden with `CLAUDE_MODEL`; the selected classroom switch target is `claude-haiku-4-5`. Your account must have access to the models used. `PORT` overrides the local port.

Run `npm run typecheck` and `npm test` for source checks and the native-model identifier test. Run `npm run agent -- combined MCP` for the native CLI experiment. Other modes are `switch`, `deny-switch` and `compact`. Topics are `MCP` and `Hooks`.

## Actual lifecycle operations

Every experiment creates an isolated owned workspace and persisted native session. The owned in-process MCP tool returns a new random classroom marker. The host validates the actual permission request before allowing that tool. Model-switch cases call the real `query.setModel` control method during this pause. The next actual assistant message supplies evidence of the effective model.

| Case | Actual model control | Actual compaction | Later recall |
| --- | --- | --- | --- |
| Switch | Pre-hook admits Haiku 4.5 | None | Not requested |
| Deny switch | Pre-hook denies with CLASSROOM_MODEL_PINNED | None | Not requested |
| Compact | No switch requested | Manual compact on owned context | Exact random marker |
| Combined | Actual admitted switch in seed phase | Manual compact on owned context | Exact random marker |

PreModelSwitch records the actual from/to models and source. It permits only the selected classroom target, or returns the explicit denial control. A rejected setModel call preserves its actual native error. The lookup still succeeds on the original model. A permitted switch produces actual PreModelSwitch and PostModelSwitch events, and the next assistant message uses the target model.

Native message metadata can resolve the requested target to a dated model identifier. The verification accepts the exact target or its eight-digit date suffix, while rejecting another family or an arbitrary suffix. It checks actual assistant metadata rather than relying solely on a successful control response.

## Actual manual compaction and retained context

Compaction cases seed eighty owned synthetic classroom facts and the native tool's random marker. A fresh query resumes that same session with the real `/compact` command and a request to preserve the marker. Actual PreCompact and PostCompact callbacks identify manual compaction. The native `compact_boundary` message supplies measured pre/post token counts and dropped-token metadata. This sufficiently sized fixture must show a real token reduction.

The actual post-compaction summary must retain the random marker. A third query resumes the same session and asks for the earlier marker without restating its value. It exposes no classroom lookup and returns a structured `marker` field. The schema requires a string but does not contain the expected marker. The actual field must match the marker exactly; no Markdown stripping or answer normalization is applied. The raw native answer and structured output are both preserved. This is a bounded retention experiment, not a guarantee that every detail of arbitrary conversations survives compaction.

Each query explicitly configures the initial model in its options. The effective switch is measured within the seed phase. Later compaction and recall queries intentionally select the initial model again while resuming the same conversation. Conversation identity and model selection are separate concerns.

## Student exercise

Compare admitted and denied switch cases using actual control responses, hook inputs and assistant model identifiers. Run compact-only and inspect the native boundary and exact later recall. Repeat combined mode with Hooks and a new random marker. Extend the model-identifier test with a foreign model and inspect how a changed context fixture affects measured compaction counts.

Reports preserve actual native phases, callback returns, model identifiers, switch-control responses, compact-boundary metadata and post-compaction summaries. The seed phase stores a description of the owned repetitive fixture in its report; actual tool results, random marker and native evidence remain intact. Credentials are removed before export. Previous results clear during new runs, source files are whitelisted and downloads contain observed evidence.

Validated with SDK 0.3.322 and native runtime 2.1.322. All model controls, native compaction and recall calls are real; the classroom context is synthetic. The original infographic is reused unchanged with provenance, and the approved cover preserves the author's photo and credit. Narration uses the requested Inworld Yash settings.

## References

- [Anthropic PreModelSwitch](https://code.claude.com/docs/en/hooks#premodelswitch)
- [Anthropic PostModelSwitch](https://code.claude.com/docs/en/hooks#postmodelswitch)
- [Anthropic PreCompact](https://code.claude.com/docs/en/hooks#precompact)
- [Anthropic PostCompact](https://code.claude.com/docs/en/hooks#postcompact)
- [Anthropic SDK session resume](https://code.claude.com/docs/en/agent-sdk/sessions)
