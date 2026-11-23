# Prompt 59 · Authorization inside a custom-tool handler

Enforce classroom project access inside an actual SDK tool. Verify owner access, cross-owner denial before the protected fixture read and explicit instructor access.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your own Anthropic API key. Run `npm start` and open `http://127.0.0.1:43159`.

The lesson was verified with Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322 and Zod 4.6.7. Run `npm run typecheck` and `npm test`. Actual CLI examples are `npm run agent -- alice alice-lab`, `npm run agent -- bob alice-lab` and `npm run agent -- instructor bob-lab`.

## Classroom identity context

The identity selector supplies a local teaching fixture for Alice, Bob or the classroom instructor. It lets students exercise actual handler authorization under controlled principal contexts. A production authenticated server session supplies this context.

The application resolves the selected fixture principal before creating the in-process MCP server. It passes that principal into the server factory. The custom tool accepts a strict project-only argument schema. Identity and role overrides are rejected as extra tool arguments.

Every request starts a fresh actual SDK session with its own evidence. The model receives the requested project identifier, and the handler uses its host-supplied principal to authorize the operation.

## Actual authorization boundary

`readAuthorizedNotes()` checks the classroom instructor role or the project's assigned owner. A denied request returns `FORBIDDEN`, null notes and public recovery guidance before the protected note lookup.

An allowed request records the protected fixture access and returns the selected synthetic notes. Owner metadata and protected note fixtures are kept in separate mappings. The access counter records calls to the protected fixture-read path.

The actual callback logs host identity, role, decision, process identifier and protected-read counts before and after authorization. It returns the public outcome as text and structured content and sets the native tool error flag for a denial.

The host compares requested project with handler input, handler and host processes, native result and final structured output. Authorization checks preserve host context and verify protected access behavior. For denied runs, the captured outcomes and visible assistant text are also checked for the exact classroom note markers and null final notes.

## Reproduce and recover

Run Alice against `alice-lab` and inspect an allowed decision with one protected read. Select **Try Bob → Alice project** and run the actual tool. The handler rejects the request, the protected read count stays zero and the native result carries an error flag.

Select **Restore Alice access** and run a fresh authorized request. Exercise Bob against `bob-lab` and the classroom instructor against another project. Compare actual host context, decisions, protected-read counts and returned synthetic notes.

Download the report for principal source, tool-only arguments, actual executions, access events, native results, lifecycle metadata, visible assistant text, scoped denied-data checks and final structured output. Reports remain local under `runs/`, and the download index clears on restart.

The query and in-process server close after consumption, and a ninety-second abort bounds each experiment. Actual inference requires network access and incurs provider charges. The project notes and identities are synthetic classroom fixtures.

The original infographic and approved author-photo cover are included with provenance.

## References

- [Agent SDK custom tools and handler implementation](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
