# Prompt 57 · Useful handled tool errors

Exercise a real custom-tool catch block with local synthetic service failures. Compare useful public error fields across actual handler, native result and final agent output.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your own Anthropic API key. Run `npm start` and open `http://127.0.0.1:43157`.

The lesson was verified with Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322 and Zod 4.6.7. Run `npm run typecheck` and `npm test`. Use `npm run agent -- success`, `unavailable`, `missing` or `unexpected` for actual CLI tool queries.

## Actual handler behavior

The local classroom fixture returns an order or throws an exception. Failure fixtures include a freshly generated synthetic credential marker and classroom internal address and stack markers in their in-memory cause. These fixtures exercise the catch block in an actual SDK custom-tool invocation.

`safeFailure()` constructs explicit public outcomes for recognized service-unavailable and order-not-found errors. Unexpected exceptions receive a fixed public fallback. The public fields include a stable code, message, recovery guidance, retryability and a generated reference. The mapper selects recognized outcomes by error type and code.

The callback records its actual input, public outcome, process identifier and cause-observed flag. It retains a fingerprint of the synthetic cause. The private cause text is used locally for that fingerprint. Returned text and structured content contain the public outcome, and `isError` follows its success value.

The host compares actual handler input and process identity, native outcome and final structured output. Native lifecycle metadata identifies the orders server with source `sdk`. Error scenarios also produce an actual native error flag and `PostToolUseFailure` event.

## Scoped observed-data checks

The host inspects the recorded executions, calls, native results, lifecycle metadata, visible assistant text, final output and SDK errors for the exact generated canary, classroom address and stack markers, and the configured API credential. It also verifies that an actual exception was caught for each failure scenario.

These checks describe the captured observable fields and synthetic test cases. The report preserves the public outcome, fingerprint and checks. It excludes the generated canary value and raw private cause text. Provider exception messages and result errors redact the configured API key before report construction.

## Reproduce and recover

Run **Order available**, then select **Try service failure** and call the tool. Inspect `SERVICE_UNAVAILABLE`, retry guidance and the actual native error. Open the observed private-detail panel to inspect the caught-cause evidence and scoped checks.

Select **Restore available order** and run a fresh session. The successful result has a distinct reference. Exercise **Order not found** and **Unexpected internal error**, compare their public messages and retryability, then restore success.

Download the report for actual public outcomes, native results, lifecycle metadata, visible assistant text, process identifiers and checks. Expand preserved evidence for the same native data. The public reference can correlate the displayed outcome with its recorded execution.

The query and in-process server close after consumption, and a ninety-second abort bounds each experiment. Reports remain local under `runs/`, and the download index clears on restart. Actual inference requires network access and incurs provider charges.

The original infographic and approved author-photo cover are included with provenance.

## References

- [Agent SDK custom-tool error results](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
