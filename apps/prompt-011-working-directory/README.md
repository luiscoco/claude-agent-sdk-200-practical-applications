# Prompt 11 · Working directory

Run the same real Claude Agent SDK task in two project directories. The SDK reads each project's README.md and discovers its CLAUDE.md instructions when the project setting source is enabled.

## Setup

Use Node.js 22 or later. Install the pinned dependencies with `npm ci`. Copy `.env.example` to `.env` and configure your local Anthropic API key. Run `npm start`, then open http://127.0.0.1:43111.

Use `npm run agent -- orbit` or `npm run agent -- harbor` for the command-line entry point. Add `--inspect` to preview fixture files without a model call. Add `--no-settings` to run with an empty settingSources array.

## Walkthrough

1. Inspect Orbit and compare README.md with CLAUDE.md.
2. Run the project query. Check the initialized absolute cwd, completed Read response, and ORBIT-TEAL instruction marker.
3. Select Harbor and repeat. The relative README.md task stays the same. The answer and instruction marker follow the selected project.
4. Disable project settings and run Harbor again. The marker should be UNKNOWN. The Read policy permits only README.md, so the agent cannot obtain the marker through an explicit file read.
5. Select the missing-directory example. The application reports PROJECT_DIRECTORY_MISSING before starting query. Select Orbit to repair the configuration.
6. Download the observed result, including SDK session information, tool observations, and the fixture comparison.

The cwd option establishes the session's working directory. Tool permissions control access. This classroom application adds a canonical-path Read policy for the selected README.md. It makes that policy visible through PreToolUse observations and permission decisions. Project instructions load through the SDK's project setting source. A fresh query is started for each run.

`npm test` covers project resolution, missing directories, and canonical-path permission decisions. `npm run typecheck` verifies the installed SDK types. Live queries require an API credential and incur provider usage charges. Each run has a five-turn limit and a USD 0.50 SDK budget limit.

The included cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [TypeScript SDK options](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Project instructions and setting sources](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- [Permission evaluation](https://code.claude.com/docs/en/agent-sdk/permissions)
