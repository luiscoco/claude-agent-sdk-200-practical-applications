# Prompt 84 · Output modification

Author: Luis Coco Enríquez

Use a post-tool hook to sanitize or replace tool output before the agent receives it.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43184`. Model calls use your account. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the local port.

Run `npm run typecheck` and `npm test` for source checks and the response-shape preservation test. Run `npm run agent -- sanitize MCP` for a native CLI experiment. Other modes are `baseline`, `invalid-shape` and `replace`; topics are `MCP` and `Hooks`.

## Four actual native Read experiments

The host creates a fresh owned text fixture containing a topic, generated email at the reserved `example.invalid` domain and a generated `CLASSROOM_TOKEN_` marker. These are synthetic classroom values, not real personal data or credentials. The prompt contains only the fixture path and asks for one actual Read followed by the exact text delivered by that tool.

| Mode | Post-tool return | Actual delivery |
| --- | --- | --- |
| Baseline | Empty object | Original synthetic markers remain |
| Sanitize | Structured Read output with redacted content | Topic and redaction labels |
| Invalid shape | Plain string as updatedToolOutput | Native runtime ignores replacement; original markers remain |
| Replace | Structured Read output with topic-only content | Topic-only replacement |

The actual PostToolUse callback records the original Read response and its native tool-use identifier. A valid replacement preserves the native Read object shape, including `type`, the file object and line metadata. It changes `file.content` and updates the line counts. It returns the new object as `hookSpecificOutput.updatedToolOutput`.

The deliberately malformed string is an owned failure control. The runtime ignores it for built-in Read and delivers the original result. A verified failure-control experiment means the app correctly observed this failed replacement; it does not mean the output was sanitized. The interface explicitly reports whether original markers reached the delivered result and model output.

The host inspects the actual user-message tool result and structured final answer for the generated markers. Successful sanitization requires their absence in both. Exact final text must match the selected mode. The host independently rereads the source file and requires it to remain unchanged in every mode.

## Scope and student exercise

PostToolUse runs after execution. Replacing delivery does not undo file writes or other tool side effects, and it does not remove original host observations or telemetry. This classroom report intentionally preserves the original synthetic data so students can compare it with the actual delivered output. Production applications must separately control their own logs and storage. This lesson's selected marker patterns are a concrete fixture policy, not a universal personal-data detector.

Run the baseline, then the malformed replacement and inspect the original markers still delivered. Repair the output shape and confirm both marker checks change. Try the topic-only replacement with Hooks. Extend the sanitization policy and meaningful preservation test, then verify actual native delivery rather than relying on the hook's return value.

Read is preapproved and a pre-tool guard admits only the one owned fixture and native identifier. Reports preserve actual tool calls, original callback responses, returned replacements, delivered results, model output and independent file evidence. Credential values are removed before export. Source files are whitelisted, and previous results clear during a new run.

Validated with SDK 0.3.322 and native runtime 2.1.322. The original infographic is reused unchanged with provenance, and the approved cover preserves the author's photo and credit. Narration uses the approved Inworld Yash settings.

## References

- [Anthropic post-tool decision control and required output shape](https://code.claude.com/docs/en/hooks#posttooluse-decision-control)
- [Anthropic SDK hook outputs](https://code.claude.com/docs/en/agent-sdk/hooks#outputs)
- [Anthropic TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)
