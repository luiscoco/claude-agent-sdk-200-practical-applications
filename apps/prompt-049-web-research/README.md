# Prompt 49 · Web research with source URLs

Run an actual native WebSearch research agent and connect its structured findings to the source URLs returned by the search tool. This classroom app searches the official `code.claude.com` and `platform.claude.com` documentation domains.

## Run locally

Install Node.js 22 or later and run `npm ci`. Copy `.env.example` to `.env` and configure your own Anthropic API key locally. Run `npm start` and open `http://127.0.0.1:43149`.

Enter a Claude documentation question of up to 200 characters. Native WebSearch receives that exact question and the displayed domain list. The actual tool response supplies source titles, URLs and duration. The model produces up to three brief structured findings with one or two supporting URLs each.

Independent validation checks each cited HTTPS URL against the actual returned source hits and approved hostnames. Verified findings include clickable source URLs. Review the factual claims against their linked documentation during editorial review. Search results and wording can vary over time.

## Native evidence and recovery

The app records actual SDK initial tools, native WebSearch calls, returned source titles and URLs, structured output and source membership checks. Successful native tool-result records preserve content length and SHA-256. Native search errors preserve their actual content. The report retains the SDK conversation outcome and source-check results.

The deliberate denial scenario attempts a real WebSearch call. The pre-tool hook denies it with `CLASSROOM_SEARCH_BLOCKED`, and the actual native tool error is displayed. The research result contains empty findings. Restore search access and run a fresh successful search to inspect its actual returned sources.

Download the observed report to compare the exact search query, domain list, native source hits and cited URLs. Reports remain local in `runs/`. Restarting clears the in-memory download index. The original main infographic and author-photo cover are included with provenance.

## Verify and explore

Run `npm run typecheck` and `npm test`. Unit-test source records are explicitly named fixtures. Use `npm run agent -- search` or `npm run agent -- blocked` for real CLI runs. Supply a custom question with `npm run agent -- search "Claude Agent SDK hooks official documentation"`. Native SDK searches require network access and incur provider charges.

For your exercise, research a second official-documentation topic, open its returned sources and compare citations with the actual hit list. Reproduce the real access-denial error, restore search access and download the new evidence. Inspect the source-membership tests for rejected fabricated citations and unsupported URL schemes.

## References

- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- [SDK structured output](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
- Installed official SDK 0.3.322 declarations for `WebSearchInput` and `WebSearchOutput`. Bundled native Claude Code is 2.1.322.

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and the final editorial presentation before release.
