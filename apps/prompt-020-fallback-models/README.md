# Prompt 20 · Fallback models

Configure the SDK's native fallbackModel option and preserve the observed failure reason, switch events, and actual response model.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, configure your Anthropic API key locally, then run `npm start`. Open http://127.0.0.1:43120.

Run `npm run agent -- fallback`, `chain`, `disabled`, or `healthy` for the CLI experiments. The disabled-fallback control returns a failing process exit status because its query fails as expected.

## Live scenarios

- The fallback experiment deliberately selects the unavailable classroom primary claude-course-missing-model. The actual SDK reports a model_not_found fallback event and completes the request on the configured real Sonnet backup.
- The chain experiment adds an unavailable classroom backup before the real Sonnet backup. The comma-separated fallbackModel value configures the native order. Inspect every observed switch and the actual final response model.
- The disabled control uses the same unavailable primary with the fallback option omitted. Its real SDK failure message remains visible and downloadable.
- The healthy experiment uses a real Sonnet primary with a Haiku backup configured. The primary completes the query, and the report records the observed absence of a fallback switch.
- The invalid configuration selects the primary as its own backup. The application rejects this duplicate before creating the query. Restore the valid fallback mode to recover.

All successful requests ask for FALLBACK_OK. The report preserves native fallback events, original model, trigger, target model, message, actual assistant-response models, result outcome, and model usage. Usage may include auxiliary runtime model calls. The final response model comes from the actual assistant message.

The SDK 0.3.322 runtime emits a native system/model_fallback event that its exported SDKMessage union has yet to include. The version-specific parser in src/events.ts validates the observed wire fields before exposing them. Unit tests cover this boundary. The live recording uses native runtime 2.1.322.

The application passes a native fallback configuration into one query. Its private child environment clears competing provider and gateway overrides for the direct Anthropic route. Each query disables built-in tools, MCP, and filesystem settings and applies a two-turn limit, USD 0.20 SDK budget limit, and a 120-second application timeout.

Availability-based fallback follows the installed runtime's supported failure conditions. The recorded failure uses an unavailable model identifier. Consult the current provider/runtime documentation when applying the configuration to other failures. The preserved event and actual response identify what occurred in each experiment.

Run `npm test` for model-chain configuration and native event parsing. Run `npm run typecheck` for the installed SDK declarations.

For practice, compare the disabled control with the same primary using a valid backup. Inspect the original failure reason, switch count, and final response model. Replace a backup with another model available to your own account and repeat the experiment.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [SDK model and fallback configuration](https://code.claude.com/docs/en/agent-sdk/configuration)
- [Availability-based fallback chains](https://code.claude.com/docs/en/model-config#fallback-model-chains)
- [TypeScript SDK options](https://code.claude.com/docs/en/agent-sdk/typescript)
