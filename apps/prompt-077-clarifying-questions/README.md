# Prompt 77 · Native clarifying questions and exact answers

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43177`. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local port.

Experiments use actual SDK and provider calls with normal usage charges. Run `npm run typecheck` and `npm test` for compilation and answer-validation lifecycle checks. The original infographic, instructor cover, source viewer and downloadable native evidence are included.

## Actual model-generated question

Choose MCP or Hooks and single or multiple selection. The task asks the model to generate one native `AskUserQuestion` about the lesson's emphasis, with Code and Diagrams options. The callback receives the actual question text, header, options, selection flag and native tool-use identifier.

The browser displays that actual question and its returned descriptions. Single-selection buttons submit the actual option label. Multiple-selection controls submit distinct actual labels, joined with `", "` when returned to the native tool. The free-text field submits the exact custom answer, including Unicode and newlines.

The callback returns allow with the original `questions` array and an `answers` record keyed by the actual full question text. Its value is the selected label, joined labels or exact free text. Custom text remains the answer value. The recorded native answer comes from this returned mapping and is verified against the actual native tool response.

The report also retains the model's structured restatement as `modelOutput`, with a separate `modelEchoExact` flag. In a live Unicode example, the native response preserved curly quotes and the model restated them as straight quotes. The application preserves the exact native answer as its recorded value and retains that observed model transformation in the evidence.

## Validation and pending state

This classroom fixture requests one question per run. Validation admits its native question structure and checks that its selection mode matches the requested experiment. Selected labels must exist in the actual options, remain distinct and respect the native single-selection flag. Free-text answers accept 1 through 1,000 characters.

Each pending question has a unique identifier inside its live job. Invalid or empty answers preserve the actual pending request. Stale or already answered identifiers are rejected. Only one live native job runs at a time. Cancelling aborts the query and clears its question wait.

Refreshing the page reloads the active job and pending question while the local server process remains running. The callback returns its answer to that same live query. The browser renders native question and report values as text.

## Native evidence and exercise

Reports preserve the actual native question input, original questions array, submitted answer, returned mapping, tool-use identifier, native tool result, recorded native answer and model restatement. The verifier compares the original array, exact question-text key and actual accepted response against the recorded answer. The separate model echo flag records restatement exactness. Configured API-key values are redacted. Reports are stored under `runs/`, and job and download indexes belong to the current server process.

Run `npm run agent -- select single MCP`, `npm run agent -- select multiple Hooks`, or `npm run agent -- text single MCP` for actual JSON evidence with explicit scripted classroom answers. An optional fifth argument supplies custom free text. Failed verification returns a nonzero exit code.

For the exercise, use Hooks. Answer the native question with one option, multiple options and a two-line custom answer. Inspect the actual returned labels and complete question-text mapping. Submit an empty free-text answer and correct it while the same request remains pending. Refresh before answering and verify that its identifier stays the same.

The student archive includes source, tests and original assets. Runtime artifacts, secrets, dependency folders and teacher recordings are excluded.

## Reference

The official guide documents the native question structure, original questions array, exact question-text keys, multiple selections and custom per-question answers. [Claude Agent SDK approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)
