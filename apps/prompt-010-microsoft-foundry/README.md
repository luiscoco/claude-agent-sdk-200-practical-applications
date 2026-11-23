# Prompt 10 · Microsoft Foundry

Configure the Claude Agent SDK to use an existing Microsoft Foundry resource, an explicit Claude deployment name, and Microsoft Entra developer credentials. The browser application verifies service access with a real SDK query and provides dated provider-compatibility notes.

## Setup

Use Node.js 22 or later and Azure CLI. Run `npm ci`. Copy `.env.example` to `.env` and configure your own resource name and deployed Claude model name. Sign in locally with `az login`, select the appropriate Azure subscription, and run `npm start`. Open http://127.0.0.1:43110.

Your signed-in identity needs model inference access, such as Cognitive Services User or Foundry User, scoped to the relevant resource or inherited from its parent. The Azure resource's firewall must permit the computer running this application.

Use `npm run agent -- --inspect` for configuration inspection and `npm run agent` for the real command-line query.

## Walkthrough

1. Check the resource name and exact deployment name in the form.
2. Inspect the resolved provider, endpoint, authentication route, and selected deployment.
3. Run the SDK query and wait for the successful READY result.
4. Inspect the SDK initialization summary and result event.
5. Read the dated provider-compatibility notes and their official source.
6. Supply a full URL as the resource name to reproduce INVALID_RESOURCE before query starts. Restore the configured resource and retry.
7. Download the observed result and compare its deployment name with your Azure configuration.

The resolver creates a private subprocess environment, enables CLAUDE_CODE_USE_FOUNDRY, sets ANTHROPIC_FOUNDRY_RESOURCE, and pins the deployment through both the model option and Sonnet mapping. It selects AZURE_TOKEN_CREDENTIALS=dev for this local teaching application. The bundled runtime supports the developer-credential category. A current Azure CLI sign-in supplies the recorded authentication. The resolver preserves the calling process environment.

## Recorded deployment

The recording uses Claude Sonnet 5.5, model version 2, hosted on Azure, with GlobalStandard capacity 10 in Sweden Central. This corresponds to 10,000 tokens per minute. The recording resource uses Microsoft Entra authentication with local API-key authentication disabled and a firewall rule limited to the recording computer's public IP. Resource and deployment names shown in the recording identify the instructor's installation. Configure your own values in the student project.

The provider notes were checked on 12 November 2026. They identify the Azure-hosted MCP tool-search limitation and Foundry availability for server-managed settings and Anthropic analytics. Local SDK hooks and MCP servers remain available. The compatibility notes are documentation-based. The READY response is verified by the actual recorded model run.

`npm test` checks resource validation, deployment mapping, credential-route selection, and preservation of the supplied environment. `npm run typecheck` checks the installed SDK types. Live calls incur Azure Marketplace model usage charges. Each query has a two-turn limit and a USD 0.10 SDK budget limit.

The original infographic and cover follow the course branding. Author: Luis Coco Enríquez.

## References

- [Claude Code and Agent SDK configuration for Microsoft Foundry](https://code.claude.com/docs/en/microsoft-foundry)
- [Provider feature availability](https://code.claude.com/docs/en/feature-availability)
- [Azure developer credential chains](https://learn.microsoft.com/en-us/azure/developer/javascript/sdk/authentication/credential-chains)
- [Claude deployments on Microsoft Foundry](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-claude)
