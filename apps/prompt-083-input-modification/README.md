# Prompt 83 · Input modification

Author: Luis Coco Enríquez

Rewrite selected tool arguments in a pre-tool hook and verify that the modified arguments reach execution.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43183`. The default model is `claude-sonnet-4-6`; `CLAUDE_MODEL` and `PORT` can be configured locally. Model calls use your account.

Run `npm run typecheck` and `npm test` for source checks and the selected-field preservation test. Run `npm run agent -- rewrite-both MCP` for the native command-line experiment. Other modes are `original`, `rewrite-path` and `rewrite-content`. Topics are `MCP` and `Hooks`.

## Actual argument propagation

Every experiment starts with an empty owned workspace. The model requests native Write with `requested-note.txt` and a draft classroom note. The host does not create the output file. A matched pre-tool callback validates that original request, creates a new argument object and returns `hookSpecificOutput.updatedInput` for the selected mode.

| Mode | Actual output file | Actual file contents |
| --- | --- | --- |
| Original baseline | requested-note.txt | Draft topic classroom note |
| Rewrite path | rewritten-note.txt | Draft topic classroom note |
| Rewrite content | requested-note.txt | Reviewed topic classroom note |
| Rewrite both | rewritten-note.txt | Reviewed topic classroom note |

All note contents include a trailing newline. The callback preserves unselected fields. It returns an empty object for the baseline and omits `permissionDecision` for each transformation, allowing the modified arguments to pass through normal native permission evaluation. Write and Read are explicitly preapproved in every experiment; the application does not claim this demonstrates interactive approval.

The original assistant tool request stays unchanged in the report. PostToolUse records the actual executed Write arguments and response with the same native tool-use identifier. Native Read then opens the effective file named by the successful Write result. The host independently reads that file and confirms the original requested file is absent when the path was redirected. All three execution observations must match the expected transformation. The model's structured result must match the independently inspected file exactly.

The application limits calls to the owned original Write and actual effective Read. Repeated callbacks for the same native identifier receive the same admission. Fresh additional calls or different paths are denied. Working-directory guards bound native filesystem access to the owned workspace.

## Student exercise

Run the original MCP baseline, then path-only and content-only transformations. Compare the unchanged argument with the selected changed field. Run both transformations with Hooks and download the observed report. Predict whether `requested-note.txt` should exist in each case before inspecting the evidence. Add a selected-field transformation in `rewrite.ts`, extend the meaningful preservation test, and verify it through a fresh native run.

The interface preserves original inputs, callback returns, actual post-tool inputs, native results and independent file proof. It clears older results while running. The source viewer exposes only whitelisted lesson files. Credential values are removed before reports are exported. These are owned synthetic classroom notes, and all model and tool operations in the demonstration are real. The original infographic is reused unchanged with provenance. The cover preserves the approved photo and author credit. Narration uses the approved Inworld Yash settings.

Validated with SDK 0.3.322 and its native runtime 2.1.322. The actual callback and file checks provide the behavior evidence for this pinned environment.

## References

- [Anthropic SDK input modification](https://code.claude.com/docs/en/agent-sdk/hooks#modify-tool-input)
- [Anthropic pre-tool decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)
- [Anthropic SDK permission evaluation](https://code.claude.com/docs/en/agent-sdk/permissions)
