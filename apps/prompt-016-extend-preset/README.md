# Prompt 16 · Extend the preset

Append a domain-specific purchase recommendation policy to the claude_code preset. The agent reads a real inventory fixture with the SDK Read tool and returns structured recommendations. The application independently verifies its arithmetic and selected policy.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy .env.example to .env, configure your Anthropic API key locally, and run `npm start`. Open http://127.0.0.1:43116.

Run `npm run agent` for the appended policy or `npx tsx src/cli.ts --base` for the base preset through the command line.

## Experiments

1. Inspect fixtures/inventory.json. The notebook needs 97 units to reach its target when its stock is below its reorder point.
2. Select the preset-only configuration and run. The base task calculates needed and proposed quantities from the inventory file.
3. Select the appended policy and run a fresh session. The notebook's needed quantity is 97 and its proposed quantity is capped at 20. Pencil needs and proposes 10. Pen needs and proposes zero.
4. Inspect the completed SDK Read observation and independent verification.
5. Reproduce the invalid-selection error, append the purchase policy, and retry.
6. Download the observed recommendations, expected values, actual systemPrompt option, tool observation, session identifier, and estimated model cost.

The systemPrompt option preserves the claude_code preset and adds the policy through append. The output schema defines the recommendation fields. The quantity cap is supplied by the appended domain policy. The independent application verifier checks that the selected policy and arithmetic are reflected in the returned values.

The application validates product counts and unique uppercase SKUs before query starts. Its canonical-path Read policy permits the inventory fixture. The SDK-added StructuredOutput tool is allowed for schema formatting. A completed Read is required before accepting a successful SDK result. The verifier checks every SKU and handles recommendations returned in a different order.

`npm test` covers capped and uncapped expectations, reorder boundaries, duplicate SKUs, invalid counts, and missing, duplicate, or incorrect recommendations. `npm run typecheck` checks the installed SDK types. Each live run has a five-turn limit and a USD 0.50 SDK budget limit.

For practice, change maximumProposal in src/inventory.ts, predict the notebook recommendation, and rerun the appended policy. Compare the observed result with the application's expected values and the actual Read response.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [Append instructions to the Claude Code preset](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- [SDK structured outputs](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
