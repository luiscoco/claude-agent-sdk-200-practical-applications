# Prompt 100 · Retention and deletion

Author: Luis Coco Enríquez

Implement session retention and deletion using supported utilities and storage policies; verify which artifacts remain.

## Run the application

Install Node.js 22 or later, extract the project and run `npm ci`, then `npm start`. Open `http://127.0.0.1:43200`. `PORT` overrides the local port. No model queries are made and no API key is required.

Run `npm run typecheck` and `npm test` for source, policy-boundary and actual native deletion checks. Run `npm run agent -- dry-run 24` for a retention plan, `npm run agent -- delete-expired 24` to delete an expired disposable copy, or `npm run agent -- protect 24` to protect it. Supported windows are 24 and 72 hours.

## Controlled classroom storage

The two original fixture files are unchanged historical transcripts from successful owned synthetic Prompt 89 experiments. Their source provenance and original SHA hashes are in `fixtures/catalog.json`. Every experiment copies them into a newly created `runs/retention-*` workspace. No original source fixture or normal user Claude configuration is deleted or modified.

The copied transcript modification times intentionally represent two age controls: one 48 hours old and one 1 hour old. These actual local file mtimes are classroom controls; they are not claims about the original recording dates. Native `listSessions()` reports these copied-file ages for the retention policy. The original transcript content hashes stay unchanged until actual deletion.

An explicitly labelled host-created text artifact is placed inside the selected copied session's subdirectory. It is a deletion-scope control, not a native subagent transcript. A separate application reference and workspace note are also created outside the native transcript tree. Their continued presence demonstrates the difference between native session history and application-owned storage.

## Retention policy and native deletion

The policy considers only session identifiers in the owned fixture catalog. Explicit protection takes precedence over age. Invalid/nonpositive timestamps are retained for review. Otherwise a native `lastModified` value at or before the cutoff is expired. A 24-hour window selects the 48-hour-old copy; a 72-hour window keeps it. The recent copy remains outside the deletion set.

Dry-run mode returns the actual native listing and retention plan without calling `deleteSession()`. Delete-expired mode calls the installed SDK's actual supported deletion utility for each eligible owned copied session. Protect mode adds the old copied session to the protected set and verifies it remains. Before native deletion, resolved transcript paths must stay within the experiment's owned native configuration.

## Verify which artifacts remain

The native worker sets process-local `CLAUDE_CONFIG_DIR` to the copied configuration before importing the SDK. After it exits, a new SDK process independently lists sessions, retrieves target metadata/messages and checks local artifact presence.

For an expired unprotected deletion, the selected native JSONL transcript and session subdirectory must be gone. The SDK metadata reader must return no target metadata and the message reader must return an empty sequence. A repeated actual `deleteSession()` call must report not found. The other copied native session must remain unchanged, as must all original fixture files.

The separate application reference and workspace note must still exist with unchanged content. This lesson deliberately retains them to make deletion scope observable: they require their own application storage policies. The application does not claim that deleting a native transcript erases separate application records, agent-created filesystem changes, backups or provider-held data. The SDK deletion utility demonstrated here concerns local session storage.

The report preserves actual native lists, cutoff, policy reasons, completed deletions, errors, repeated-delete result, independent reader evidence and artifact presence. An expected protected or recent result is verified as retention, not presented as a successful deletion. Presence checks treat only `ENOENT` as absent and propagate other filesystem errors.

## Student exercise

Start with a 24-hour dry run and inspect the expired and recent reasons. Execute the same policy on a new disposable copy and compare native transcript artifacts with the separate application files. Protect the old session and repeat. Increase the window to 72 hours and explain why no native session is deleted. Inspect exact cutoff behavior and discuss the additional storage policies needed for application references and workspace files.

The meaningful policy test covers the exact cutoff boundary, protection, invalid timestamps and identifiers outside the owned catalog. Actual native utility tests and browser checks cover dry run, deletion, protection, longer retention, missing history, repeated deletion and retained artifacts. Generated disposable run copies are excluded from student distribution.

The original infographic is reused unchanged with image provenance. The approved cover retains the instructor portrait and `Author: Luis Coco Enríquez` below it. Video production uses the requested Inworld Yash settings, cube transitions and timed focus rectangles.

## References

- [Anthropic TypeScript session storage and utilities](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Anthropic session persistence and filesystem distinction](https://code.claude.com/docs/en/agent-sdk/sessions)

## Public repository fixtures

The recorded classroom transcripts in this public copy have sanitized machine paths and short project-directory names. The catalog records hashes of the sanitized files and their original source hashes. These historical fixtures are not newly generated model results.
