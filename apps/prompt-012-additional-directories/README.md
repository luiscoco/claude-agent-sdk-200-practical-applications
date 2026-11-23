# Prompt 12 · Additional directories

This runnable application compares native SDK file-viewer access and configuration discovery across fresh sessions. It uses the pinned TypeScript SDK 0.3.322 and its bundled native runtime.

## Setup

Use Node.js 22 or later and run `npm ci`. Copy `.env.example` to `.env`, configure your Anthropic API key locally, and run `npm start`. Open http://127.0.0.1:43112.

The command-line entry point is `npm run agent`. Add `--grant` to include the shared directory, `--no-settings` to disable optional filesystem settings, or `--inspect` to check fixture paths without starting a model request.

## Experiments

1. Leave Add shared directory unchecked and run. The session file viewer reads project/README.md. The two sibling probes return null.
2. Enable shared access and run a fresh session. The additionalDirectories array contains exactly fixtures/shared. The native viewer returns the shared price list, and the unrelated private sibling remains unavailable.
3. With project settings enabled, inspect shared-pricing-note in the SDK's slash_commands initialization field. It comes from fixtures/shared/.claude/commands/shared-pricing-note.md.
4. Disable project settings and run again. The shared file remains readable through readFile(). The shared command is absent from initialization.
5. Download the actual session report and compare each probe with the included fixture file.

The application calls the running Query object's readFile() method for a sidebar-style file viewer. This API restricts ordinary files to session working directories and applies Read rules. It returns null for denied, missing, or transport-error cases. The application verifies that each fixture exists before starting the session and independently compares successful contents with the fixture. Each experiment also waits for a successful model result of READY. File probes run through the SDK control API. The model task is the short session readiness check.

Command discovery is observed through the live initialization message. The shared command is included as a discovery fixture. Its body is available in the source viewer.

`npm test` checks the configured directory roots and the separate setting-source toggle. `npm run typecheck` checks the actual installed SDK API. Live runs incur provider usage charges, with a two-turn limit and a USD 0.10 SDK budget limit per experiment.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [SDK options and readFile() permissions](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Filesystem settings and configuration sources](https://code.claude.com/docs/en/agent-sdk/typescript#settingsource)
