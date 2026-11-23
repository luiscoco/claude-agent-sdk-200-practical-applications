# Prompt 13 · Settings sources

Inspect real user, project, and local settings through the pinned SDK's resolveSettings() API. The application displays the merged value, loaded sources, and SDK-provided provenance.

## Setup

Use Node.js 22 or later. Run `npm ci`, then `npm start` and open http://127.0.0.1:43113. The experiments inspect configuration locally. Use `npm run agent -- default` for the command-line entry point.

The app sets CLAUDE_CONFIG_DIR for its own process to fixtures/user-config before dynamically importing the SDK. That directory supplies the included user settings fixture. The fixture project supplies .claude/settings.json and .claude/settings.local.json. These files are included explicitly for the classroom experiment.

## Experiments

1. Omit settingSources and resolve. SDK 0.3.322 loads user, project, and local sources. The fixture result is 21 days from local settings.
2. Select User only, Project only, and Local only. Observe values 7, 14, and 21 with their provenance.
3. Select User + project. Project contributes the effective value of 14 days.
4. Select all three. Local contributes 21 days.
5. Select the empty array. The three optional sources are excluded and the fixture cleanup and origin values are unset in the SDK snapshot.
6. Reproduce the invalid-selection error, restore the default selection, and download the observed SDK report.

The cleanup value is used to illustrate a scalar setting's precedence. The classroom origin environment variable is another observed field from the actual SDK merge. The application returns selected classroom fields and their provenance.

resolveSettings() is an alpha API. The SDK documents differences between its local snapshot and a live query, including policy helpers, server-managed settings retrieval, and permission-mode trust filtering. Managed policy uses a separate tier, including when the optional filesystem source array is empty. This experiment inspects the settings merge through the SDK API.

`npm test` exercises the real installed SDK resolver across all source combinations, checks its omitted-option default, and verifies the empty-array case. `npm run typecheck` checks the installed declarations.

For practice, change the project fixture's cleanup value and predict the result with User + project selected. Compare it with the all-source selection and explain the winning source shown by the SDK.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [SDK setting sources and defaults](https://code.claude.com/docs/en/agent-sdk/typescript#settingsource)
- [resolveSettings() API and snapshot behavior](https://code.claude.com/docs/en/agent-sdk/typescript#resolvesettings)
- [Settings precedence](https://code.claude.com/docs/en/settings)
