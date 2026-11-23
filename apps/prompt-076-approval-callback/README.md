# Prompt 76 · Approve, reject or revise an actual tool request

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43176`. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local port.

Experiments use actual SDK and provider calls with normal usage charges. Run `npm run typecheck` and `npm test` for compilation and pending-request lifecycle checks. The original infographic, instructor cover, source viewer and downloadable native evidence are included.

## Actual pending Write

Choose MCP or Hooks and start the query. The model requests one native Write to a fresh owned classroom note. The exact request reaches `canUseTool` under the default permission mode with an empty allow list. The callback publishes the actual native tool name, use identifier and input, then waits for the operator's structured decision.

- **Approve original Write** returns `behavior: 'allow'` with the original input. The actual file contains the requested Draft note.
- **Deny Write** returns `behavior: 'deny'` and a concrete classroom reason. The native reply records the denial and the file remains absent.
- **Revise and approve Write** returns allow with `updatedInput`, preserving the owned file path and replacing its content with the operator's submitted text. The actual file contains that revised content.

After a successful Write, the model calls native Read on the output file. The final structured result copies the actual text read, including newlines. The host independently reads the file and compares its complete contents with the callback's effective input.

The argument hook admits one exact original Write and one Read of its owned output after approval. Valid requests return an empty hook result, preserving native permission handling. Unexpected paths, original contents or additional operations receive a hook denial.

## Pending-request lifecycle

Each approval has a unique question identifier and belongs to an in-memory native job. Invalid revision content preserves the pending approval. Old or already answered identifiers are rejected. Only one native job runs at a time. Cancelling aborts the query and clears its pending approval.

Refreshing the browser reloads the active job and its pending native request while the local server process stays running. The callback continues waiting in that same query. Revisions accept between 1 and 2,000 characters. The browser displays request and report content as text.

Runtime reports preserve the original request, operator answer, effective updated input, native calls and replies, actual Read, file contents and final checks. Configured API-key values are redacted. Reports are written under `runs/`, and native jobs and download indexes belong to the current server process.

## CLI and exercise

Run `npm run agent -- allow MCP`, `npm run agent -- deny MCP`, or `npm run agent -- revise Hooks` for actual JSON evidence with explicit scripted classroom answers. An optional fourth argument supplies custom revised text. Failed verification returns a nonzero exit code.

For the exercise, use Hooks. Approve its original Write, reject a fresh request and revise another to a two-line instructor note. Compare the original model input, effective callback input, native Read and exact actual file. Refresh while an approval is pending and verify that the same request remains available.

The student archive includes source, tests and original assets. Runtime artifacts, secrets, dependency folders and teacher recordings are excluded.

## References

The SDK input guide describes native approval callbacks and returning revised tool arguments. [Claude Agent SDK approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)

The TypeScript reference documents the `PermissionResult` and `updatedInput` fields. [Claude Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
