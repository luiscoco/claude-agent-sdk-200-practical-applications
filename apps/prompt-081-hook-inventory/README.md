# Prompt 81 · Hook inventory

Author: Luis Coco Enríquez

List every hook supported by my installed SDK and map each event to one practical use case.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`, then `npm start`. Open `http://127.0.0.1:43181`.

The hook inventory uses the installed SDK's exported `HOOK_EVENTS` array and its actual package version. Every currently installed event has a distinct practical classroom use case. The pinned TypeScript SDK 0.3.322 exposes 33 events. Search the event name, trigger description or use case, select an event and download the complete JSON inventory.

Inventory discovery works locally without a model request. Set `ANTHROPIC_API_KEY` in your process environment to run the separate actual native probe. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`, and `PORT` defaults to `43181`.

Run `npm run agent` to print the actual installed inventory. Run `npm run agent -- probe MCP` to register its hooks and perform a real native Read. `Hooks` is the other supported classroom topic. `npm run typecheck` checks the source, and `npm test` verifies complete, distinct use-case coverage against the installed export.

## Installed inventory and actual observations

`src/inventory.ts` reads the actual installed SDK package version, then maps every exported hook name to a practical use case. If a future SDK introduces an unmapped name, the inventory reports that gap explicitly. The checked classroom version maps all 33 names.

The native probe registers callbacks for every exported event. Its tool-event matchers select Read. A fresh owned workspace contains one synthetic classroom note. The model calls native Read once, and the pre-tool callback validates that exact owned path. The report correlates the actual pre-tool and post-tool callbacks with the native Read identifier and independently checks the preserved file and final model result.

The observed filter shows only callback event names that actually arrived during the selected run. The unobserved filter lets learners inspect the other installed events and their practical use cases. Conditional and lifecycle events depend on the task and session. The first checked probe observed UserPromptSubmit, PreToolUse, PostToolUse, PostToolBatch and Stop. Every preserved event includes its actual input and timestamp.

## Exercise

Search for compaction events and compare the precompaction snapshot use case with the postcompaction check. Inspect PermissionRequest, Elicitation and the worktree events. Run a fresh Hooks probe, select its observed filter and correlate PreToolUse with PostToolUse using the actual native identifier. Download both the complete installed inventory and the observed report.

The project reuses its original infographic unchanged and records its source hash. The cover follows the approved course artwork with the author's credit below his photograph. Native model calls and hook observations are real. The lesson's Inworld Yash narration uses the approved course settings.

## References

- [Anthropic SDK hook callbacks and supported events](https://code.claude.com/docs/en/agent-sdk/hooks)
- [Anthropic hook input and output reference](https://code.claude.com/docs/en/hooks)
- [Anthropic TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)
