# Prompt 82 · Pre-tool enforcement

Author: Luis Coco Enríquez

Use PreToolUse to enforce a path restriction, including calls that have already been preapproved.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment and run `npm start`. Open `http://127.0.0.1:43182`. You can set `CLAUDE_MODEL` and `PORT` locally. The default model is `claude-sonnet-4-6`.

Select a path case and MCP or Hooks, then run its actual native Read. Every scenario preapproves Read with `allowedTools: ['Read']`. The enabled pre-tool hook resolves the actual target and admits canonical paths inside the owned `allowed` directory. Native working-directory guards bound the broader owned workspace.

Run `npm run typecheck` and `npm test` for source and directory-boundary checks. `npm run agent -- alias MCP` runs a native directory-alias experiment through the command line. Other mode arguments are `allowed`, `restricted`, `sibling` and `no-hook`.

## Actual path experiments

| Case | Requested path | Actual canonical target | Path hook | Native Read |
| --- | --- | --- | --- | --- |
| Allowed | allowed/note.txt | allowed/note.txt | Admit | Completes |
| Restricted | restricted/note.txt | restricted/note.txt | Deny | Native error |
| Directory alias | allowed/alias/note.txt | restricted/note.txt | Deny | Native error |
| Prefix sibling | allowed-neighbor/note.txt | allowed-neighbor/note.txt | Deny | Native error |
| Owned baseline | restricted/note.txt | restricted/note.txt | Disabled | Completes |

All fixtures and the directory alias belong to a fresh owned workspace. The Windows alias uses an actual directory junction. On supported Unix filesystems, Node creates the corresponding directory link. The baseline reads an owned synthetic restricted note inside this workspace with the application path hook disabled. Comparing it with the enabled restricted-path case demonstrates the hook's effect while native Read preapproval stays configured.

The host resolves both the allowed root and actual target with `realpath`. It then uses a directory-relative boundary check. That rejects a neighboring directory whose name starts with `allowed`, and rejects an alias whose resolved target belongs to `restricted`. An unresolved target receives the recorded path-resolution denial.

## Native evidence

Each report preserves the model's actual Read, native tool use identifier, hook input, canonical target, hook decision and native result. Verification compares the actual canonical target with the owned fixture, checks the selected admission and native outcome, and confirms zero host permission callbacks. The host independently checks that the fixture stayed unchanged. Denied paths return a null model text value, and successful paths must reproduce the actual file text exactly.

The SDK's Read preapproval warning concerns `canUseTool`. The actual pre-tool hook still receives the native Read and can deny the requested path. The report's callback counts and native error demonstrate the measured behavior under pinned SDK 0.3.322 and native runtime 2.1.322.

After a denial, select the allowed Hooks note and run a fresh query. Verify its successful Read and download the observed report. The interface clears prior results while a new query runs and displays the actual native outcome for the completed request.

The original infographic is reused unchanged with recorded provenance. The approved course cover includes the author's credit below his photo. Native model calls and path-hook decisions are real. Narration uses the approved Inworld Yash settings.

## References

- [Anthropic pre-tool hook decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)
- [Anthropic SDK callbacks and matchers](https://code.claude.com/docs/en/agent-sdk/hooks)
- [Anthropic permission evaluation](https://code.claude.com/docs/en/agent-sdk/permissions)
