# Prompt 62 · Remote MCP over HTTP

Connect to the public Claude documentation MCP service using its actual Streamable HTTP endpoint. Inspect remote discovery, native SDK connection status, a real documentation search and an exact source-linked excerpt from that result.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your Anthropic API key. Run `npm start` and open `http://127.0.0.1:43162`.

Run `npm run typecheck` and `npm test`. CLI examples are `npm run agent -- connected Agent SDK MCP stdio configuration` and `npm run agent -- invalid-route connection test`.

Verified dependencies are Agent SDK 0.3.322, bundled Claude Code 2.1.322, MCP SDK 1.32.2 and Zod 4.6.7. Provider availability and the documentation service are external dependencies.

## Actual remote connection

`src/remote.ts` connects an MCP client through `StreamableHTTPClientTransport` to `https://code.claude.com/docs/mcp`. The preflight preserves the actual server identity and advertised tool schemas. It closes its connection after discovery.

`src/agent.ts` separately configures that HTTP endpoint in the real Agent SDK. The running query preserves native MCP status, then invokes `mcp__docs__search_claude_code_docs` using the exact selected query. A host hook permits that search with its expected arguments. The classroom experiment uses the public documentation search.

The report includes actual returned content and a SHA-256 hash of its JSON representation. The model creates a short verbatim excerpt from that content. Automated checks establish connectivity, discovery, exact arguments, a successful native response and valid final structure. The excerpt must contain six to twenty-five words and occur verbatim in the returned documentation body under the exact source URL.

## Connection failure and recovery

**Try invalid endpoint** selects a deliberately invalid path on the same public documentation origin. The direct MCP connection returns its actual HTTP or protocol failure. This experiment ends at connection preflight and records that SDK inference was skipped. The failure panel preserves the observed error.

**Restore official endpoint** runs a fresh connection and SDK search. The UI distinguishes the preflight from the native SDK invocation. Compare the actual server identity, qualified tool name, returned response, verified excerpt and session ID.

The app accepts the two provided endpoint choices. Searches are public documentation queries. Each query and returned public result are sent through the configured services during the actual experiment.

## Evidence and practice

Download the observed report for endpoint configuration, direct tool discovery, native status, exact invocation, returned content, hash and final source-linked excerpt. Reports stay under `runs/`. The download index clears when the application restarts.

Distributed course evidence contains the short matched excerpt, source URL and response hash. Full retrieved documentation remains in the local recording archive and live application reports.

Try another documentation query and compare the returned source content. The original infographic and approved author-photo cover are included with provenance. Credentials are supplied through the local process environment. Actual inference requires network access and incurs provider charges.

## References

- [Agent SDK remote MCP and HTTP transport](https://code.claude.com/docs/en/agent-sdk/mcp)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
