# Prompt 53 · Tool registration and qualified names

Register two real in-process MCP servers and verify their tool names through actual SDK discovery and calls. Both servers expose a local tool named `lookup`. The registration keys produce `mcp__catalog__lookup` and `mcp__warehouse__lookup`.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your own Anthropic API key locally. Run `npm start`, then open `http://127.0.0.1:43153`.

The lesson was verified with Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322 and Zod 4.6.7. Run `npm run typecheck` and `npm test`. Use `npm run agent -- MIC-101 complete` or `npm run agent -- MIC-101 missing-warehouse` for real CLI queries.

## Actual registration flow

`src/registration.ts` defines two `tool()` handlers with the same local name and different descriptions. Each reads a clearly labelled local classroom fixture. The catalog returns a product name and price in euro cents. The warehouse returns stock and a shelf location. Each handler validates input and records its actual process identifier and outcome.

`createSdkMcpServer()` registers the handlers in separate server objects. Their internal metadata names are `catalog-service` and `warehouse-service`. The query map uses the registration keys `catalog` and `warehouse`. Those keys determine the observed qualified namespaces. Native lifecycle metadata records the same registration keys with source `sdk`.

The application preserves the actual SDK initialization tool list, qualified calls, native results and final structured output. Checks compare discovery with the selected registration map and verify actual handler input, in-process execution, native values and final values. The query closes its connection and both server instances after consumption. A ninety-second abort bounds each experiment.

## Omitted registration and repair

Select **Omit warehouse server** and run an actual query. The `mcpServers` map contains only the catalog server. The `allowedTools` list still includes both expected qualified names. Actual SDK discovery lacks the warehouse tool, the catalog handler runs and the final result lists the missing warehouse name with a null warehouse outcome.

The displayed `REGISTRATION_INCOMPLETE` message describes actual missing discovery. This scenario also records the successful catalog result. Select **Restore both servers** and run a fresh session to verify both actual namespaces and both fixture results.

Download the report to inspect expected and discovered tool names, registration keys, server metadata names, native provenance and the actual outputs. Reports are stored locally under `runs/`. The in-memory download index clears when the app restarts.

For an exercise, select `CAB-202`, verify its 1200-cent price and 37 available units, then omit and restore the warehouse registration. Trace each qualified name from its query map key to the corresponding local handler.

Actual inference requires network access and incurs provider charges. The source viewer includes the implementation shown in the video. The original infographic and approved author-photo cover are included with provenance.

## References

- [Agent SDK custom tools and registration](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
