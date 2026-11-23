# Prompt 97 · Session organization

Author: Luis Coco Enríquez

Rename and tag sessions using the supported utilities and verify that the changes persist.

## Run the application

Install Node.js 22 or later, extract the project and run `npm ci`, then `npm start`. Open `http://127.0.0.1:43197`. `PORT` overrides the local port. No model queries are made and no API key is required.

Run `npm run typecheck` and `npm test` for source and actual native organization checks. Run `npm run agent -- organize "MCP classroom review" ready` for a CLI experiment. Modes are `organize`, `replace` and `clear`; tags are `ready` and `review`. Titles are trimmed, nonempty and at most 90 characters.

## Actual SDK utilities on disposable historical copies

The two original fixture transcripts are unchanged historical recordings from successful owned synthetic Prompt 89 experiments, with original SHA hashes and source provenance in `fixtures/catalog.json`. Each experiment creates a fresh disposable copy inside this application's `runs` tree. Only the first copied session is organized. The original fixtures and the other copied session must remain unchanged.

The worker sets its process-local `CLAUDE_CONFIG_DIR` to that experiment's copied native configuration before importing the SDK. Actual `renameSession()` and `tagSession()` calls update the copied native transcript. The application does not rename files, fabricate metadata rows, start a new model conversation or modify the user's normal Claude configuration.

Organize mode sets the chosen title and tag. Replace mode first sets an earlier draft title/tag, then calls the utilities again with the final values to demonstrate that the most recent metadata wins. Clear mode sets the title and tag, then passes actual `null` to `tagSession()` and verifies the tag is absent while the title remains.

## Independent persistence verification

After the mutation worker exits, the coordinator starts a fresh SDK reader process. That process independently calls `getSessionInfo()` and `getSessionMessages()` against the copied transcript. The returned native title and tag must match the final requested state. Session identity remains the same. The actual conversation message sequence must hash identically before mutation and after the independent reload.

The report preserves completed utility calls, actual metadata observed after each call, process exit evidence, persisted custom-title/tag entries, message hashes and checks. These recorded operations are application observations of completed native utility calls, not synthetic hook events. Metadata changes append supported native records; they do not rewrite the model's earlier conversation messages.

The source fixture hashes and the other copied session are checked independently. The changed copied transcript must actually differ from its original hash. The native test verifies title replacement and clearing a tag across new reader processes while preserving the conversation message hash. Browser checks cover all modes, an alternate title/tag, report download, invalid input, source allowlisting, original assets and mobile width.

## Student exercise

Rename and tag a copied session, then compare original, changed and independently reloaded metadata. Use replace mode to inspect earlier and later values after each native call. Clear the tag and verify that the title and native identity stay intact. Repeat with your own classroom title. Explain why a metadata label is different from a native session identifier and why a new reader process is useful evidence of persistence.

This is a local classroom utility using disposable copies, not a multi-user session authorization system. Original working-directory fields remain historical metadata; reads and mutations search only the copied configuration. Generated run copies and reports are excluded from student distribution, which includes the original owned fixture files for reproduction.

The original infographic is reused unchanged with provenance. The approved cover retains the instructor portrait and `Author: Luis Coco Enríquez` below it. Video production uses the requested Inworld Yash settings, cube transitions and timed focus rectangles.

## References

- [Anthropic TypeScript renameSession and tagSession utilities](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Anthropic persisted session history](https://code.claude.com/docs/en/agent-sdk/sessions)

## Public repository fixtures

The recorded classroom transcripts in this public copy have sanitized machine paths and short project-directory names. The catalog records hashes of the sanitized files and their original source hashes. These historical fixtures are not newly generated model results.
