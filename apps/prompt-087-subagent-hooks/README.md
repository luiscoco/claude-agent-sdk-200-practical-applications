# Prompt 87 · Subagent hooks

Author: Luis Coco Enríquez

Track subagent startup and completion through hooks and correlate each event with the parent task.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43187`. Model calls use your account, including the actual helper. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the local port.

Run `npm run typecheck` and `npm test` for source checks and the foreign-parent/foreign-child correlation test. Run `npm run agent -- reader MCP` for a native CLI experiment. Other modes are `auditor` and `filtered-auditor`; topics are `MCP` and `Hooks`.

## Actual parent and helper execution

The application registers two SDK agent definitions, `note-reader` and `note-auditor`, each restricted to Read. One real parent Agent request starts the selected helper in the foreground. That helper reads one owned synthetic classroom note and returns its text. The parent waits and returns the exact note text in structured output.

The pre-tool guard admits one selected Agent call and one actual Read from a subagent. It rejects parent-thread reads, other paths, background execution and additional helper launches. The child definition does not expose Agent. Native working-directory guards bound filesystem access to the owned workspace. The original fixture must remain unchanged.

| Case | Actual helper | Lifecycle matcher | Observed start/stop callbacks | Actual child Read |
| --- | --- | --- | --- | --- |
| Reader | note-reader | note-reader or note-auditor | One each | One |
| Auditor | note-auditor | note-reader or note-auditor | One each | One |
| Filtered auditor | note-auditor | note-reader only | None | One |

The nonmatching control still executes a real auditor. Its native task-start event and child Read prove execution while the lifecycle callbacks remain absent because their matcher excludes that helper type. Missing observer callbacks alone are not evidence that a helper did not run.

## Native identifier correlation

The parent Agent call has its own tool-use identifier. The actual `task_started` event names that identifier in `tool_use_id` and supplies its native `task_id`. The child Read's forwarded message contains both `parent_tool_use_id` and `agent_id`. The start and stop hooks supply `agent_id`, `agent_type` and the parent session. These actual fields must form the same parent/task/child chain. The child post-tool Read callback independently records its input and actual file content.

The stop callback preserves the helper's actual final message and active flag without blocking or inventing a completion event. The recorded native tool results must succeed, and the parent structured result must match the independently observed child Read text exactly.

The native Agent hand-back includes framing, an agent identifier and usage metadata around the helper's report. These fields are preserved in the observed native result. They are not part of the classroom file text. The parent prompt explicitly excludes that metadata; strict final verification catches any accidental inclusion instead of silently normalizing it away.

## Student exercise

Run reader and auditor with both lifecycle types matched. Inspect the native parent tool-use identifier, task identifier, child parent linkage and lifecycle identifiers. Run filtered-auditor and confirm its child still executes while those lifecycle observers remain absent. Restore the matching configuration with Hooks and verify both callbacks and the new actual file text. Extend the meaningful correlation test with another mismatched native identifier.

All recorded model calls, SDK helper launches, Reads and lifecycle hooks are real. Only note contents are synthetic owned fixtures. The browser clears prior results during new runs, exposes whitelisted source files and downloads observed reports with credential values removed.

Validated with SDK 0.3.322 and native runtime 2.1.322. The original infographic is reused unchanged with provenance. The approved course cover preserves the author's photo and credit. Narration uses the requested Inworld Yash settings.

## References

- [Anthropic SubagentStart](https://code.claude.com/docs/en/hooks#subagentstart)
- [Anthropic SubagentStop](https://code.claude.com/docs/en/hooks#subagentstop)
- [Anthropic SDK subagents](https://code.claude.com/docs/en/agent-sdk/subagents)
- [Anthropic TypeScript SDK task messages](https://code.claude.com/docs/en/agent-sdk/typescript)
