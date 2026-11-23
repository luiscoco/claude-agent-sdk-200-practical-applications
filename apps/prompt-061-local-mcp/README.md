# Prompt 61 · Local MCP through stdio

Connect the real Claude Agent SDK to a separate local MCP server process. Query synthetic classroom catalog entries and inspect actual discovery, connection status, native tool results and a child-process audit.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your Anthropic API key. Run `npm start` and open `http://127.0.0.1:43161`.

Run `npm run typecheck` and `npm test`. The tests launch an actual stdio MCP child process. CLI examples are `npm run agent -- local-mcp`, `npm run agent -- missing` and `npm run agent -- agent-loop`.

Verified versions are Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322, MCP SDK 1.32.2 and Zod 4.6.7.

## Connection and invocation

`src/agent.ts` copies the synthetic catalog into an isolated workspace and supplies a `type: 'stdio'` configuration under the `catalog` server key. The command is the current Node executable. Arguments identify the standalone server script, copied fixture and local audit file.

The native SDK launches the process and initializes MCP. The tool list loads at startup with a bounded sixty-second connection wait and a one hundred and fifty second query abort. The application records `query.mcpServerStatus()` and the tools advertised in the SDK initialization message. Claude invokes `mcp__catalog__get_lesson` with the exact selected slug.

`src/mcp-server.mjs` registers `get_lesson` and connects a `StdioServerTransport`. Standard input and output carry MCP protocol traffic. Write additional diagnostics to standard error. The handler reads the synthetic catalog, writes its input, outcome and process ID to a local audit, and returns text plus structured content.

The UI verifies the connected server identity, qualified tool discovery, separate process ID, exact handler input, matching native result and preserved final structured answer. The source view exposes the actual code used by the application.

## Failure and recovery

Use **Try missing lesson** and run the actual tool. The server remains connected while its callback returns `LESSON_NOT_FOUND`, a null lesson and the native error flag. Use **Restore known lesson** for a fresh successful experiment. The report records actual connection and domain outcomes independently.

Query `agent-loop` as another valid entry. Add a synthetic entry to `fixtures/catalog.json`, then run a fresh experiment for its slug. Each experiment copies the current fixture. The sample catalog describes classroom examples.

## Evidence and lifecycle

Download the observed report for native status, exact calls, server audit, tool results, lifecycle hooks, session ID and final answer. Reports remain under `runs/`. The download index clears when the app restarts. Closing the query shuts down its owned local MCP connection and child process.

Actual inference requires provider network access and incurs provider charges. Credentials are supplied through the local process environment. Original infographic and approved author-photo cover are included with provenance.

## References

- [Agent SDK MCP connections and stdio configuration](https://code.claude.com/docs/en/agent-sdk/mcp)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
