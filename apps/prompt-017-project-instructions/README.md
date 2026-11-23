# Prompt 17 · Project instructions

Add project conventions through CLAUDE.md and a path-scoped rule. The real SDK agent reads a target file, suggests an identifier, and reports instruction markers. Native InstructionsLoaded hook events verify which fixture instruction files were loaded and why.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy .env.example to .env, configure your Anthropic API key locally, and run `npm start`. Open http://127.0.0.1:43117.

Run `npm run agent` for the TypeScript target. Use `npx tsx src/cli.ts --docs` for documentation or `npx tsx src/cli.ts --no-settings` for the disabled project-source experiment.

## Experiments

1. Inspect fixtures/project/CLAUDE.md. It supplies PROJECT-TEAL and a lower camelCase naming convention.
2. Inspect .claude/rules/typescript.md inside the fixture project. Its src/**/*.ts pattern scopes the TS-CORAL marker and Widget suffix convention.
3. Run the TypeScript target with project settings enabled. The expected suggestion is learningDashboardWidget. The SDK reports the project file at session start and the TypeScript rule with a path_glob_match reason and triggering target path.
4. Run docs/guide.md. The project convention produces studentGuide, and the observed project instruction file supplies its marker.
5. Disable project settings and read the TypeScript target again. The instruction markers are UNKNOWN and the fixture instruction-loading events are absent. The naming suggestion is recorded as an observed model output in this mode.
6. Reproduce the invalid-target error, restore the TypeScript target, and download the observed convention report.

The application verifies the fixture title, enabled convention behavior, markers, actual completed Read, and expected fixture instruction-file events. Read access is checked against the selected canonical target path. The SDK loads project context through its project setting source. The permission policy applies to the agent's explicit tool calls.

The InstructionsLoaded hook records observed filenames, load reasons, matching globs, and triggering paths. The report also includes the SDK context memoryFiles summary as supplemental runtime metadata. In the recorded installation, the path-scoped rule is observed through its InstructionsLoaded event.

`npm test` checks target selection and expected marker scope. `npm run typecheck` checks the installed SDK declarations. The live recordings verify both targets and the disabled setting source. Each live run has a five-turn limit and a USD 0.50 SDK budget limit.

For practice, predict the instruction filenames and markers for both targets before running. Change the project marker value in CLAUDE.md, run a fresh session, and compare the observed marker with the actual instruction-loading event.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [Project instructions and setting sources](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- [Path-scoped project rules](https://code.claude.com/docs/en/memory)
- [InstructionsLoaded hook](https://code.claude.com/docs/en/hooks#instructionsloaded)
- [SDK context usage metadata](https://code.claude.com/docs/en/agent-sdk/typescript)
