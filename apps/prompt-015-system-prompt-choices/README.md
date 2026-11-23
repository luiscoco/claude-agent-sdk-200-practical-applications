# Prompt 15 · System-prompt choices

Run one task through three real Claude Agent SDK configurations and compare the observed responses and reported input tokens. The three modes are the minimal SDK default, the claude_code preset, and a custom Spanish-language tutor prompt.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy .env.example to .env, and configure your Anthropic API key locally. Run `npm start` and open http://127.0.0.1:43115.

The command-line entry points are `npm run agent -- minimal`, `npm run agent -- preset`, and `npm run agent -- custom`.

## Experiments

1. Run Minimal SDK default. The application omits the systemPrompt option.
2. Run the claude_code preset. Its option uses the SDK's preset object representation.
3. Run Custom tutor. The application supplies its own system-prompt string, including the TUTOR | prefix instruction.
4. Choose Compare all three to run fresh sessions sequentially with the same task, model, and other options.
5. Reproduce the invalid-profile error, select Custom tutor, and retry.
6. Download the latest request's report, including responses, actual options, usage, session identifiers, and estimated costs.

Each profile card shows its latest completed result. A selected-profile request adds or updates that card. A comparison request updates all three cards. The downloaded report contains the results from that request. If a comparison fails partway, the interface displays completed responses with the failure and clears its download link for the incomplete request.

The task and model are held constant. The reported input token count sums the SDK result's input_tokens, cache_creation_input_tokens, and cache_read_input_tokens. It represents the observed request usage, including relevant context. Responses and token counts can vary between runs. The custom-prefix check verifies the specific formatting instruction supplied by the application.

`npm test` checks the actual option representations, omission of systemPrompt for minimal mode, and invalid-profile validation. `npm run typecheck` checks the installed SDK declarations. Live runs incur provider usage charges. Each profile has a two-turn limit and a USD 0.20 SDK budget limit.

For practice, change the custom tutor's output format and predict the response before running it. Keep the same user task while comparing the three profile configurations, then trace each visible option to src/profiles.ts.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [SDK system-prompt choices](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- [TypeScript SDK result usage](https://code.claude.com/docs/en/agent-sdk/typescript)
