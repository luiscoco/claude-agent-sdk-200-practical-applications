# Prompt 64 · Application OAuth and protected MCP credentials

Complete an authorization-code flow with S256 PKCE, then pass its runtime bearer token to the real Claude Agent SDK HTTP MCP configuration. The protected catalog derives its subject and scope from the validated credential.

The local classroom authorization server supplies a fixed identity fixture named `classroom-learner`. Its consent, code exchange, bearer-token checks and MCP invocations use actual HTTP requests. The provider and resource server share the application process and run on loopback HTTP.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your Anthropic API key. Run `npm start` and open `http://127.0.0.1:43164`.

Run `npm run typecheck` and `npm test`. Verified dependencies are Agent SDK 0.3.322, bundled Claude Code 2.1.322, MCP SDK 1.32.2 and Zod 4.6.7.

## Complete the classroom connection

Click **Connect classroom account**. The host discovers protected-resource and authorization-server metadata over HTTP and validates the configured issuer and endpoints. It creates a server-side PKCE verifier and state transaction, then opens the classroom consent page with the S256 challenge.

Authorize the read-only catalog scope. The callback checks the recorded state, issuer and transaction lifetime before sending the code to the token endpoint. The authorization server checks S256 proof, client, redirect URI and resource binding, consumes the code and issues the scoped token.

Click **Call protected MCP tool**. The host supplies its session credential through `mcpServers.secure_catalog.headers.Authorization`. The resource server validates that bearer token before constructing the MCP server. Its tool reads synthetic catalog data and returns the authenticated subject alongside the actual lesson outcome.

Try `local-mcp` and `agent-loop` as catalog slugs. The source view exposes the actual provider, callback, header configuration, protected handler and report-redaction code.

## Observe revocation and reconnect

Click **Revoke classroom token**, then call the protected endpoint again. The actual HTTP response is 401, and the app records that SDK inference was skipped. The existing host session supplies its inactive credential so students can inspect the rejected request.

Reconnect through classroom consent and run a fresh SDK call. The new token has a different public reference. The real HTTP audit, native MCP status, handler outcome and final structured answer are preserved for comparison.

## Credential handling and evidence

The client stores its verifier and bearer credential in server-side memory. The browser receives an HttpOnly, SameSite=Lax session cookie. The issuer stores access-token hashes. Authorization codes expire after sixty seconds, client transactions after five minutes and access tokens after fifteen minutes. The browser cookie lasts thirty minutes.

The callback validates the issuer advertised in metadata. The token is bound to the classroom resource and `catalog.read` scope. Declined consent, invalid callback issuer, code reuse, proof mismatch, expiry and revocation are exercised by the unit and browser checks.

SDK queries disable session persistence. The application redacts the issued MCP token and configured provider API key from returned reports and checks their absence before saving. Reports preserve public scope, subject, token reference, HTTP admission and native outcome evidence. Download the redacted report from the application. Reports remain under `runs/`, and the download index clears on restart.

The classroom consent page uses the shared course visual style. The original infographic and approved author-photo cover are included with provenance. Actual inference requires provider network access and incurs provider charges.

## References

- [Agent SDK MCP authentication and runtime headers](https://code.claude.com/docs/en/agent-sdk/mcp)
- [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
