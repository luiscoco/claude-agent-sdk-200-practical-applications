# Prompt 99 · Persistence controls

Author: Luis Coco Enríquez

Demonstrate available transcript-persistence controls and identify differences between Python and TypeScript.

## Run the application

Install Node.js 22 or later, extract the project and run `npm ci`, then `npm start`. Open `http://127.0.0.1:43199`. The default TypeScript comparison works without Python. `PORT` overrides the local port. This lesson uses actual native transcript-only messages with assistant turns disabled; no model credentials or model inference charges are required.

For Python profiles, create a Python 3.12 environment and install the pinned dependencies with that environment's interpreter: `python -m pip install -r requirements-lock.txt`. Set `PYTHON_PATH` to its interpreter. On Windows this is typically `.venv/Scripts/python.exe`; on macOS/Linux `.venv/bin/python`. Configure the value in your process environment or copy `.env.example` to `.env` and set it there. Python mode fails before execution when no interpreter is configured.

Run `npm run typecheck` and `npm test`. The TypeScript native integration test always runs; the optional Python integration test runs when `PYTHON_PATH` is configured. Production verification runs both. Run `npm run agent -- typescript MCP`, `npm run agent -- python Hooks` or `npm run agent -- compare MCP` for the actual native CLI comparisons.

## Actual native appends without assistant inference

Each profile starts with a new owned workspace and private native configuration. The application sends an actual streamed SDK user message containing a random owned classroom marker, with `shouldQuery: false`. This supported message control appends context without starting an assistant turn. It is not a simulated model answer and does not test answer quality or context recall.

The caller assigns a supported session UUID through each SDK's session option. Actual native initialization and result identifiers must match that requested value. Native completion must report success, zero turns, zero model cost and zero API duration, with no assistant messages. The application preserves the actual message evidence. A configuration or native error does not count as a successful persistence comparison.

## TypeScript and Python controls

The pinned TypeScript SDK is 0.3.322 with bundled native Claude Code 2.1.322. The default control omits `persistSession`; the disabled control sets the actual supported `persistSession: false` option. Both append the same kind of owned context in separate fresh native sessions.

The pinned Python SDK is 0.2.180 with bundled native Claude Code 2.1.321. The Python control uses the default environment, then sets `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` through `ClaudeAgentOptions.env` for the disabled profile. The program inspects the installed options dataclass: this pinned Python version has no first-class `persist_session` field. TypeScript's first-class option is checked by compilation and actual native behavior. Python's environment route is also actually executed, not only described from documentation.

The experiments clear any inherited history-suppression flag in their local process environment so the default profile is a real default control. Global user settings and normal Claude configuration are not changed. Every query uses its own configuration directory and no exposed file tools.

## Independent storage checks

After native completion, a new SDK reader process inspects the owned workspace. It lists actual JSONL transcript files, matches the original user append UUID and random marker against stored native rows, and calls actual `getSessionMessages()` to independently retrieve history. A persistent profile must contain its actual appended marker. A disabled profile must have no native transcript and no retrieved messages.

The selected profile's configuration, native zero-turn completion, transcript count and independent history result are shown separately. The complete comparison verifies all expected language profiles and distinct native session identities. The separate host-created note must remain in every workspace: transcript-persistence settings do not erase arbitrary application files or disable all possible application logging.

The native test verifies TypeScript default/disabled behavior and, when configured, Python default/environment suppression. Browser checks execute both languages, compare four profiles on another classroom topic, inspect actual profile selection, verify zero-turn results and download reports. Source viewing includes the actual Python program. Exports remove credential values, although the transcript-only demo needs none.

## Student exercise

Run TypeScript mode and compare default persistence with `persistSession: false`. Configure the pinned Python environment and compare default history with its environment suppression control. Inspect each native init/result identity, zero-turn completion and independent history read. Repeat with Hooks. Explain the SDK option differences and why neither persistence control removes the separate host-created workspace file.

The application demonstrates storage with native transcript-only appends; it does not claim that a fresh model response was generated or that missing history was successfully resumed. Generated run directories and exploratory probe evidence are excluded from the student package.

The original infographic is reused unchanged with provenance. The approved cover retains the instructor photograph and `Author: Luis Coco Enríquez` below it. Video production uses the requested Inworld Yash settings, cube transitions and timed red focus rectangles.

## References

- [Anthropic session persistence controls and SDK differences](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Anthropic TypeScript persistSession and shouldQuery message control](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Anthropic Python options reference](https://code.claude.com/docs/en/agent-sdk/python)
