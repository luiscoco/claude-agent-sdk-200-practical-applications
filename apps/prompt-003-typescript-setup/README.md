# Prompt 3 — TypeScript setup

Install Node.js 22 or newer, then run `npm ci` inside this project. Copy `.env.example` to `.env` and configure your Anthropic API key locally. Run `npm run agent` for the command line example, or `npm start` and open http://127.0.0.1:43103 for the browser application.

The project uses ES modules and `tsx` to run TypeScript. `src/agent.ts` calls the real Claude Agent SDK and consumes the message stream. It returns a result only after a successful SDK result message. The example disables built-in tools, MCP servers and filesystem settings sources.

Each live run consumes API credit. An empty task is rejected before a model call. Use the failure button in the application to reproduce that validation path, then restore the sample and run again.

`npm run typecheck` checks the TypeScript project. The lockfile pins installed dependencies. The video demonstrates this exact entry point and actual SDK messages. SDK and model output can change across releases and environments.

Exercise: change the prompt to request a short explanation of TypeScript ES modules. Predict which observed message types will appear, run the task, and inspect the downloaded result. Explain why the assistant text and a successful result message serve different purposes.

The original infographic is reused. Every cover displays Author: Luis Coco Enríquez below the instructor photograph. The [official quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart) describes installation and execution, and the [TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript) documents the message and query types.
