# Prompt 22 — Agent Loop Lab

A runnable teaching application for this prompt:

> Create an agent that reads a file, performs a calculation, and reports the result; explain the automatic execution loop.

The live mode uses the actual Claude Agent SDK. The local mode is explicitly a non-AI calculation. No simulated model events are presented as a live run.

## Start the application

Requirements: Node.js 22 or newer, npm, internet access for installation, and an Anthropic API account with credit for live mode. The SDK starts its bundled runtime as a child process; allow that process on your machine.

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env locally and set ANTHROPIC_API_KEY. Never commit or share it.
npm start
```

Open http://127.0.0.1:43122. The server binds to your local computer. Keep this classroom application local; it is not a multi-user hosted service.

The optional CLAUDE_MODEL setting overrides the lesson default, `claude-sonnet-4-6`. Use a model available to your account. The recording used SDK 0.3.322; the lockfile pins the complete installed dependency tree. A run has a four-turn limit, a $0.50 SDK budget setting, and a three-minute application timeout. API costs and latency vary; the budget setting is a runtime control, not a billing guarantee.

## Follow the demonstration

1. Leave the valid sample selected. Its five numbers produce count 5, total 50, minimum 5, maximum 15.
2. Click **Run live Claude agent**. Inspect the observed Read request and response in the timeline.
3. Compare expected and actual values in the report details. Download the JSON report and event log.
4. Select **Sample with an error** and run again. Line 3 is rejected before any model call. No success report is created.
5. Repair the sample. **Verify locally** checks arithmetic without Claude and labels that mode explicitly.
6. Open **Real source code**. It serves the actual files used by the server, rather than separate demonstration snippets.

The original main infographic is reused without alteration. The cover retains the instructor photograph, Claude icon and Prompt 22 title, with the required credit: **Author: Luis Coco Enríquez**.

## How the code works

| File | Responsibility |
|---|---|
| `src/agent.ts` | Calls `query`, consumes its async stream, restricts Read to the run's input, captures actual hooks, returns schema-based output. |
| `src/numbers.ts` | Parses integers, calculates a reference answer, rejects unsafe arithmetic or a mismatched model result. |
| `src/service.ts` | Writes the real input, manages run state, validates the result, saves evidence and reports. |
| `src/server.ts` | Serves the local application, event stream, permitted source files and report downloads. |
| `public/app.js` | Displays observed events, distinguishes live and local runs, clears stale results on failure. |

The SDK drives model/tool iterations. The application does not manually recreate the model loop. `outputFormat` makes the SDK expose an additional `StructuredOutput` formatting tool; the permission policy handles it explicitly. It has no file-read capability. Every final statistic is still independently checked.

`cwd` is context, not an OS security boundary. This example limits the exposed Read tool using canonical file paths and disables project settings and MCP servers. It does not provide container isolation. Do not replace this policy with unrestricted shell access for untrusted workloads.

Each run writes `runs/<run-id>/values.txt` and `events.jsonl`. A verified run additionally writes `report.json` and `report.md`; a failed run writes `failure.json`. The event log records public runtime observations, not private chain-of-thought. File paths, session IDs, timestamps and estimated cost are genuine run metadata.

## Command line and tests

```powershell
npm run verify                  # local calculation, no API call
npm run verify -- --invalid      # expected input failure
npm run verify -- --agent        # real Claude run; consumes API credit
npm test
npm run typecheck
npx playwright install chromium
npm run test:browser
```

The default browser suite checks the application without spending model credit. One additional live case is opt-in:

```powershell
$env:LIVE_AGENT_TEST='1'
npm run test:browser
```

If Chromium is already installed elsewhere, set `CHROMIUM_PATH` to its executable. Browser tests may reuse an already running server on port 43122. Restart that server after changing backend code or credentials. Unit tests deliberately inject a test double for incorrect model results; those tests are not evidence of a live model call.

## Exercise

Replace the input with `-4`, `6`, and `0`, one per line. Predict the result, verify locally, then run Claude. Explain which events prove a real file read occurred. Finally try a decimal, an empty file, and an integer outside JavaScript's safe range.

Solution: count 3, total 2, minimum -4, maximum 6. Invalid input must fail before a model call and offer no verified report. A model result with a different total must also be rejected. The test suite covers that latter case deterministically.

## Recording and sources

The video combines real browser footage, the actual application source, and a still close-up of the observed Read response for legibility. The close-up is captured from the completed live run; it does not simulate a new tool call. The course-production workspace additionally contains `scripts/lesson-plan.json`, Inworld narration generation, Playwright recording and FFmpeg assembly scripts. The student ZIP contains the standalone application and tests; production tools and paid-service credentials are excluded.

- [Official TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Official SDK hooks](https://code.claude.com/docs/en/agent-sdk/hooks)
- [Official structured output guide](https://code.claude.com/docs/en/agent-sdk/structured-outputs)

Test outputs and the recorded live-run evidence accompany the pilot release. A successful sample establishes the demonstrated behavior, not correctness for every possible input, model or future SDK version.
