# Prompt 88 · Session lifecycle

Author: Luis Coco Enríquez

Implement supported session, notification, and configuration hooks; identify language-specific gaps.

## Run the application

Install Node.js 22 or later, extract this project and run `npm ci`. Set `ANTHROPIC_API_KEY` in your local process environment, run `npm start` and open `http://127.0.0.1:43188`. Model calls use your account. Each experiment includes two real model queries: startup and resume of the same native session. `CLAUDE_MODEL` overrides the default `claude-sonnet-4-6`; `PORT` overrides the port.

Run `npm run typecheck` and `npm test` for source checks and the support-versus-observation test. Run `npm run agent -- native-commands MCP` for the native CLI experiment. Use `callbacks` to omit the native settings-command observers. Topics are `MCP` and `Hooks`.

## Actual session and configuration experiment

Every experiment creates an isolated owned workspace and native configuration directory. It starts a native session, executes one synthetic MCP note lookup and then resumes the same logical session in a fresh worker for a second lookup. Each request uses an actual host permission callback. Approval is a fixed classroom response after validating the actual tool name and input.

During the first permission callback, `updateSettings('localSettings', { outputStyle: 'Explanatory' })` invokes the native settings writer. The host independently reads that actual file, then performs an external edit to set `outputStyle: 'Learning'`. The live native watcher emits a real `ConfigChange` callback with `source: 'local_settings'` and the owned file path. Independent inspection confirms the final settings.

Only the fresh owned `.claude/settings.local.json` is modified. No global user settings are changed. A brief permission wait gives the actual configuration watcher time to deliver its event. The report preserves both native tool requests and their successful results, actual host decisions and the same session identifier across startup and resume.

## Two observer transports

The application registers SDK callbacks for SessionStart, SessionEnd, Notification and ConfigChange, with UserPromptSubmit and Stop as additional observed anchors. The native-commands mode also registers settings-command hooks for the four lifecycle names. Its bundled Node observer receives native JSON on stdin and appends it to an owned JSONL evidence file. These records are real native invocations, not host-generated event simulations.

In the verified SDK 0.3.322 / native 2.1.322 headless runs:

| Event | Actual SDK callback | Actual settings-command hook |
| --- | --- | --- |
| SessionStart | Not observed | Startup and resume recorded |
| SessionEnd | Not observed | Both worker exits recorded, reason other |
| Notification | Not observed during this permission-wait experiment | Not observed |
| ConfigChange | Actual local-settings external edit observed | Same actual edit observed when command observers enabled |

The two SessionEnd records describe the native workers ending, not deletion of the logical session. The same session is actually resumed after the first worker exits. An absent callback is labelled not observed in this run; it is not generalized into a claim that the event never works elsewhere.

## Language-specific availability

The table checks the four event names against the installed TypeScript SDK's actual `HOOK_EVENTS` export. Python callback availability comes from the linked official SDK hook matrix: SessionStart and SessionEnd are not Python SDK callbacks; Notification and ConfigChange are documented for Python. Python can use settings-command hooks for session lifecycle. This application does not claim a Python runtime test.

Declared language support, callback registration and actual observed events are shown separately. The Notification registration is real, but this headless permission wait did not produce a native notification. No notification event is fabricated to fill the table.

## Student exercise

Compare callbacks mode with native-commands mode. Trace the same native session through startup and resume. Verify the actual local-settings callback and compare it with the command observer's independent record. Inspect the documented Python differences and the actual Notification count. Repeat with Hooks and predict which observations change when command observers are omitted.

The checks require successful native queries, actual resumed identity, one tool execution per phase, matching permission identifiers, independently read native-writer settings and the external edit, the actual ConfigChange callback and correctly sourced startup/resume command events. Reports preserve original callback and command JSON, native results and actual observation counts with credential values removed. The source viewer is whitelisted and previous results clear while a new experiment runs.

The original infographic is reused unchanged with provenance. The approved cover preserves the author's photo and credit. Narration uses the requested Inworld Yash settings.

## References

- [Official SDK hook availability by language](https://code.claude.com/docs/en/agent-sdk/hooks#available-hooks)
- [Native SessionStart lifecycle](https://code.claude.com/docs/en/hooks#sessionstart)
- [Native SessionEnd lifecycle](https://code.claude.com/docs/en/hooks#sessionend)
- [Native ConfigChange event](https://code.claude.com/docs/en/hooks#configchange)
- [Native Notification event](https://code.claude.com/docs/en/hooks#notification)
