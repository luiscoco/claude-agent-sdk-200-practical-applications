# Prompt 66 · MCP resource discovery, URI reads and callable tools

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start`, then open `http://127.0.0.1:43166`.

The default model is `claude-sonnet-4-6`, configurable with `CLAUDE_MODEL`. `PORT` changes the local app port. Model-driven experiments incur normal provider usage. Direct protocol regression tests run through `npm test`. Run `npm run typecheck` to compile the TypeScript source.

The application includes the original infographic, the instructor cover, an actual source viewer and report downloads. Its classroom fixture contains two synthetic lesson resources. Each independent query starts its own stdio MCP server and records a separate process audit.

## Actual protocol sequence

1. The SDK exposes `ListMcpResourcesTool` and `ReadMcpResourceTool` as built-in helpers. The model invokes resource listing for server `library`, causing the actual `resources/list` request.
2. The model reads the requested `course://lessons/` URI. The server handles `resources/read` and returns JSON text with a title, paragraph and segment durations, together with its URI and MIME type.
3. For an existing resource, the model invokes `mcp__library__total_minutes` with the returned segment durations. This actual `tools/call` computes the total and returns its input segments, total and server process identifier.
4. The verifier compares the native resource response and calculation result with their recorded server events. It also checks the final structured output against the synthetic fixture values.

The resource supplies contextual data identified by a URI. The callable tool performs a calculation using explicit arguments. Both classroom operations are read-only. Their separate methods, inputs and native results are preserved in the report.

The implementation targets the pinned MCP SDK's protocol behavior. The generic resource helpers are documented built-in tools. The Agent SDK query's separate `readMcpResource()` control method in this version targets MCP Apps `ui://` resources. This application uses the model-visible generic helpers shown in its actual initialization and call evidence.

## Failure and recovery

Choose **Try missing URI** and run the experiment. Discovery completes, the requested URI is read, and the server records `RESOURCE_NOT_FOUND` with an actual MCP protocol error. The calculation is skipped and the structured result preserves the missing-resource outcome.

Choose **Restore listed URI** and run again. The agent-loop resource has segment durations `[4, 6, 3]`, totaling 13 minutes. The second resource, `course://lessons/mcp-resources`, has `[5, 4, 7]`, totaling 16 minutes.

The host permission hook admits each exact helper or calculation call once. It checks the server name, requested URI and expected segment arguments. Additional attempts are denied and retained with their native errors. The fixture text supplies classroom data.

## Evidence and command-line use

Downloaded reports preserve the requested URI, real session identifier, native server status, helper availability, model calls, permission decisions, native outcomes and server audit. Runtime report redaction checks the configured API key's exact value. Run artifacts stay under `runs/`, and a fresh server process starts a new in-memory download index.

Run `npm run agent -- course://lessons/agent-loop` or `npm run agent -- course://lessons/missing` for actual JSON evidence. An unsuccessful verification returns a nonzero exit code. The source package excludes runtime outputs, credentials, dependencies and teacher recordings.

For the exercise, read the second resource and verify its 16-minute total using the actual segments and calculation evidence. Identify the three protocol methods and the input each receives.

## References

The SDK documents the native generic resource helper inputs and outputs. [Claude Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)

The pinned protocol's resource specification describes URI discovery and resource contents. [MCP resources specification](https://modelcontextprotocol.io/specification/2025-11-25/server/resources)
