# Prompt 21 · First query

Build a small agent query that returns an answer with built-in tools and MCP servers explicitly disabled.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, configure your Anthropic API key locally, then run `npm start`. Open http://127.0.0.1:43121.

Run `npm run agent` for the arithmetic example. Pass your own prompt as a quoted argument to the CLI for another question.

## Query flow

The query in src/agent.ts supplies a string prompt and explicitly configures tools as an empty array, mcpServers as an empty object, and settingSources as an empty array. The model is selected through CLAUDE_MODEL with the recorded classroom model as its default. It has a one-turn limit and a USD 0.10 SDK budget limit.

The asynchronous message loop observes native initialization, records available tools and MCP servers, counts actual assistant tool-use blocks, and returns the successful result text. It reports SDK result failures as application errors and closes the query in finally.

The UI's Verified status requires native initialization, a nonempty answer, zero initialized tools, zero MCP servers, and zero tool-use blocks. This checks the configured tool-free query flow. The recording also checks the arithmetic and Spanish greeting answers against their classroom expectations. Custom model responses remain observed outputs for students to review.

Run the arithmetic example, select the Spanish greeting, reproduce the empty-prompt guard, restore a valid question, and download the observed report. The blank-input guard runs before SDK initialization.

Run `npm test` for prompt validation and `npm run typecheck` for the installed SDK declarations. For practice, write a new short question, predict its response, run it, and inspect the actual answer with the empty tool and MCP lists.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart)
- [TypeScript query options and messages](https://code.claude.com/docs/en/agent-sdk/typescript)
