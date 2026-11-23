# Prompt 63 · File-loaded MCP and strict configuration

Load an explicit MCP JSON file and compare actual discovery with `strictMcpConfig` enabled. The runnable app creates a separate classroom project configuration so students can observe an unintended server appearing in merged discovery and being excluded by strict mode.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your Anthropic API key. Run `npm start` and open `http://127.0.0.1:43163`.

Run `npm run typecheck` and `npm test`. CLI examples are `npm run agent -- merged local-mcp`, `npm run agent -- strict local-mcp` and `npm run agent -- malformed local-mcp`.

Verified dependencies are Agent SDK 0.3.322, bundled Claude Code 2.1.322, MCP SDK 1.32.2 and Zod 4.6.7.

## Actual file loading

`fixtures/mcp-template.json` defines the explicit `catalog` server. `src/configuration.ts` resolves its classroom executable and file-path placeholders, writes `mcp-approved.json` into the isolated experiment workspace, then reads and validates that actual file. The report preserves its SHA-256 hash and loaded server entries.

Each workspace also receives a separate `.mcp.json` defining a read-only classroom server named `unintended`. Both servers use the standalone stdio executable with synthetic catalog data and separate handler-audit paths.

## Merged and strict discovery

The real SDK query receives `mcpServers` from the parsed explicit file. The classroom project setting source is enabled, and inline settings permit its synthetic project server.

With **Merged**, `strictMcpConfig` is false. Actual native discovery includes `catalog` from the dynamic configuration and `unintended` from the project scope. The agent invokes the selected catalog tool and preserves its actual outcome.

With **Strict**, `strictMcpConfig` is true. The native SDK ignores the separate project configuration. Its actual server list and advertised tools contain the explicitly supplied catalog server. Every entry in the explicit file remains part of the configured set.

A host hook permits the exact requested catalog invocation. The report checks that the unintended server's handler audit is absent. It preserves actual status, scope and source fields, the selected catalog execution, child-process identity, native tool result and final answer.

## Malformed file and recovery

**Try malformed file** writes the deliberately incomplete JSON fixture to the explicit configuration path. The actual JSON parser fails before SDK inference, and the UI preserves that configuration-stage error. **Restore strict config** rebuilds the valid explicit file and runs a fresh strict experiment.

Try `agent-loop` with both modes and compare actual discovery and returned catalog values. The fixture entries describe synthetic classroom lessons.

## Evidence

Download the observed report for the loaded configuration, file hash, actual native server list, scopes, discovery, child-process audit and final outcome. Reports remain under `runs/`. The download index clears when the application restarts. Closing the query closes its owned local MCP connections.

Actual inference requires provider network access and incurs provider charges. Credentials are supplied through the local process environment. The original infographic and approved author-photo cover are included with provenance.

## References

- [Agent SDK MCP configuration](https://code.claude.com/docs/en/agent-sdk/mcp)
- [TypeScript SDK options](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Claude Code strict MCP CLI option](https://code.claude.com/docs/en/cli-reference)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
