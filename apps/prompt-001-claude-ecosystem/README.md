# Prompt 1 · Understand the Claude ecosystem

Compare the Claude Agent SDK, Claude Code CLI, Anthropic client SDK and Claude Managed Agents. Run the same classroom project summary through three actual interfaces and inspect their native response contracts.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43101. Run `npm run agent -- embedded` for the CLI. Other routes are terminal, api and managed. Add wrong-client after embedded to reproduce the deliberately mismatched response parser. Run `npm run typecheck` and `npm test` for offline checks.

The project explicitly pins Agent SDK 0.3.322 and Anthropic client SDK 1.8.0 in its package and lock file. The recorded Agent SDK and bundled CLI runtime were 0.3.322 and 2.1.322.

## Four implementation routes

The application selects a documented interface for each classroom goal. The Agent SDK embeds the Claude Code runtime in a Python or TypeScript service operated by the application. Claude Code CLI serves terminal work and headless tasks. The client SDK sends direct Messages API requests with request and tool handling controlled by application code. Managed Agents provides a hosted harness configured through agent, environment, session and event APIs.

The four comparison cards link to their official references. The managed selection displays a documentation-backed comparison with comparisonOnly true in its report. Its nativeResponse is null. The live demonstrations execute the other three entry points against the actual classroom fixture.

## Three real application executions

Embedded runs query with a scoped Read tool and asks the real agent to read fixtures/project.txt. The loop records the actual Read call, native runtime version and successful SDK result. The application reads text from result on the successful result message.

Terminal resolves the actual optional native runtime package for the current platform and architecture, then executes that CLI with -p, stream-json and verbose. It parses actual stdout events and preserves the native Read call and final result. Arguments use execFile without a shell. The fixture and supplied system prompt match the embedded example. Ambient filesystem settings and MCP configuration are disabled for these examples.

API reads the fixture using application code and supplies its text to client.messages.create. The real Messages API returns a message containing text content blocks. The application extracts those blocks through its client-message response contract. The direct request does not expose a file tool. The report records applicationProvidedFileContent true and its actual native message.

Every live route verifies the Course Compass name, TypeScript language and COMPASS-001 marker in the actual answer. Agent and CLI routes also require an observed native Read call. All three preserve their native responses and observed interface evidence for download.

## Response-contract failure and recovery

The deliberate wrong-client scenario runs the real embedded agent and then passes its native result to the client-message parser. The actual application guard rejects the absent content array with RESPONSE_SHAPE_MISMATCH. The original successful agent result and Read call remain preserved. Restore the matching parser and run a fresh embedded query to recover the answer.

Each execution has a 90-second abort timeout. Agent and CLI paths also use four agent-loop turns and a USD 0.50 SDK budget limit. The client request uses a 200-token output limit. The server permits one comparison at a time, and finally clears its timer and closes the SDK query. Reports are stored under runs.

## Exercise

Choose a goal for your own application and inspect its route card. Run the matching classroom entry point, compare native result and message shapes, reproduce the response-contract mismatch, and restore the correct parser. Trace the actual Read call or application-supplied fixture text into the verified answer.

The original main infographic and photo cover are reused. Author: Luis Coco Enríquez.

## References

- [Agent SDK overview and comparison](https://code.claude.com/docs/en/agent-sdk/overview)
- [Claude Code programmatic CLI](https://code.claude.com/docs/en/headless)
- [Anthropic client SDKs](https://platform.claude.com/docs/en/cli-sdks-libraries/overview)
- [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
