# Prompt 19 · Model selection

Select an available model explicitly and compare its requested value with runtime model identifiers from a real Claude Agent SDK response.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, configure your Anthropic API key locally, then run `npm start`. Open http://127.0.0.1:43119.

Run `npm run agent -- --list` to discover the authenticated model catalog. Run `npm run agent -- claude-sonnet-4-6` for an explicit identifier or `npm run agent -- sonnet` for the alias experiment. The CLI returns a failing exit status when the SDK reports an unsuccessful request.

## Experiments

Refresh the live Anthropic Models API catalog and select an entry. The default classroom selection is claude-sonnet-4-6, which was available during recording. Run the real query, inspect its native init model, assistant-message model, model usage keys, and actual MODEL_OK answer.

Select sonnet and repeat. The SDK runtime resolves the alias using its installed version and provider configuration. The query also records supportedModels picker metadata. The authenticated API catalog and successful inference response provide separate observations.

Try the unavailable classroom model identifier. The request reaches the real SDK and preserves its observed error in a downloadable report. Restore the explicit ID and run again. A separate format guard rejects empty or malformed selections before starting a query.

## Reproducibility and provider configuration

Record the exact model ID, SDK and native runtime versions, prompt, options, session metadata, and observed response. Current API model IDs use pinned versions, including dateless IDs from the 4.6 generation onward. Convenience aliases can change as runtime/provider defaults evolve. Model responses can vary between repeated runs.

Provider naming differs. Anthropic accepts its API model ID, Bedrock uses the identifier or inference profile required by its endpoint, Google uses the supported version for its configured service, and Foundry uses a deployment name. The reference panel was reviewed on 12 November 2026. The runnable experiments in this lesson use the Anthropic API. The child environment clears competing provider flags, gateway URL/auth overrides, and default family-model mappings before starting its direct-provider session.

Queries disable built-in tools, MCP servers, and filesystem setting sources. Each has a two-turn limit, a USD 0.20 SDK budget limit, and a 120-second application timeout. Reports preserve unsuccessful runtime outcomes. The UI's Verified status requires the expected response and an observed assistant model.

Run `npm test` to check selection validation and `npm run typecheck` to check the installed SDK declarations. For practice, select another model from your live catalog, repeat the request, and compare its observed model identifiers and usage report with the alias run.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [SDK session model configuration](https://code.claude.com/docs/en/agent-sdk/configuration)
- [Runtime aliases and provider naming](https://code.claude.com/docs/en/model-config)
- [Models API discovery](https://platform.claude.com/docs/en/api/models/list)
- [Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)
