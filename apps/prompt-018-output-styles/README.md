# Prompt 18 · Output styles

Create and activate a project output style that explains a real code repair and reports observed verification results.

## Setup

Use Node.js 22 or later and a Git Bash installation on Windows. Run `npm ci`, copy `.env.example` to `.env`, configure your Anthropic API key locally, and run `npm start`. Open http://127.0.0.1:43118.

Run `npm run agent` for the teaching-report style. Run `npx tsx src/cli.ts --default` for the built-in default style.

## Experiment

The template calculator concatenates numeric arguments as strings. Three tests fail on each fresh copy. The SDK agent reads the calculator and tests, uses Edit to correct the calculator, then executes `node --test --test-reporter=tap tests/calculator.test.mjs` through Bash.

The project style lives in `fixtures/template/.claude/output-styles/teaching-report.md`. Its frontmatter preserves the coding instructions. It requests Changes, Why, and Verification headings. The query uses the claude_code preset, the project setting source, and `settings.outputStyle`. The private child environment explicitly selects the full coding system prompt through `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0`.

The native init message supplies the observed active output style. PostToolUse records the completed Read, Edit, and Bash observations. The application checks the actual edited file, the observed Bash TAP test totals, the required report headings when teaching-report is selected, and an independent host test run. A run is marked Verified only when these checks pass. The final explanation is the actual model response and can vary between sessions.

Each request creates an isolated UUID workspace under runs and leaves the original template available for another experiment. The independent child test runner clears an inherited NODE_TEST_CONTEXT value so nested verification executes its own tests. Model queries have an eight-turn limit and a USD 1 SDK budget limit.

Compare the teaching-report and default modes, reproduce the invalid-style guard, restore the teaching style, and download the observed report. The local application permits explicit tool access to the calculator and its tests, editing the calculator, and the exact test command. Inspect the guard implementation in src/agent.ts.

Run `npm test` to check fresh-copy behavior, failing and passing verification, style validation, and TAP parsing. Run `npm run typecheck` to check the installed SDK declarations.

For practice, add a fourth numeric assertion to the template tests, run a fresh repair, and verify the observed tool and independent test totals. Extend the style with a concise teaching note and compare the actual final responses.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [Output styles](https://code.claude.com/docs/en/output-styles)
- [System prompts and project settings](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- [SDK options and tool hooks](https://code.claude.com/docs/en/agent-sdk/typescript)
