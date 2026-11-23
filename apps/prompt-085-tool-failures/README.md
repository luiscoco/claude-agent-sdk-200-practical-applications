# Prompt 85 · Tool failures

Author: Luis Coco Enríquez

Observe tool failures through the supported failure hook and record a useful diagnostic.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43185`. Model calls use your account. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the port.

Run `npm run typecheck` and `npm test` for source checks and the diagnostic test. Run `npm run agent -- returned-error MCP` for the native command-line experiment. Other modes are `success`, `thrown-error` and `permission-denied`. Topics are `MCP` and `Hooks`.

## Actual failure-hook observations

The application registers an actual SDK MCP server with one `lookup_note` tool. Its owned in-process handler supplies a synthetic classroom note or deliberately exercises a selected error case. Missing-note and offline errors are classroom fixtures; they do not claim to be an external service outage. Every experiment makes a real model call and native MCP tool request.

| Case | Actual handler runs | Native result | Failure hook | Success hook |
| --- | --- | --- | --- | --- |
| Success | Once | Note text | None | Once |
| Returned error | Once | isError result, CLASSROOM_NOT_FOUND | Once | None |
| Thrown error | Once | Converted native error, CLASSROOM_STORE_OFFLINE | Once | None |
| Permission denial | Never | Pre-execution native denial | None | None |

The `PostToolUseFailure` matcher targets the actual MCP tool name. Its callback records the original tool input, native tool-use identifier, error and interruption flag. The diagnostic maps known classroom codes to an explicit next step and retry guidance. Missing data requires restoring the owned fixture; the offline fixture can be retried after restoration. Unknown errors do not acquire retry permission, and cancellation takes precedence over the error code.

The diagnostic is advisory. The observer returns an empty object and does not rewrite failed output, repeat the tool call or execute instructions found in an error. The raw native error remains in the evidence and reaches the model. Recovery is a fresh, explicitly selected successful query; there is no automatic retry loop.

## Verify and recover

Compare the returned-error and thrown-error cases. Confirm their actual native failures and correlated callbacks. Then run the permission-denied control: its pre-tool hook denies the request before handler execution, so no failure callback is expected. Finally select success with Hooks and verify a fresh successful result and success hook.

The checks require exactly one actual native request, the expected handler count and native error status, the correct failure/success callback counts and matching identifiers and inputs. Known failures must produce the expected useful diagnostic. The final structured result must match the actual outcome. The interface clears prior results during new runs, exposes whitelisted source files and downloads observed evidence with credential values removed.

## Student exercise

Run the offline case with Hooks and inspect its recorded recovery guidance. Switch to success and start a fresh query. Compare the two native identifiers and hook counts. Add another owned failure code, define its recovery step and extend the meaningful diagnostic test. Validate both the new native failure and the fresh recovery rather than inventing an event from the selected mode.

Validated with SDK 0.3.322 and native runtime 2.1.322. The original infographic is reused unchanged with provenance. The approved cover preserves the author's photo and credit; narration uses the requested Inworld Yash settings.

## References

- [Anthropic supported post-tool failure event](https://code.claude.com/docs/en/hooks#posttoolusefailure)
- [Anthropic SDK hooks and matchers](https://code.claude.com/docs/en/agent-sdk/hooks)
- [Anthropic custom SDK MCP tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)
