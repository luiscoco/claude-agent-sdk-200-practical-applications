# Prompt 74 · Planning and automatic editing

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43174`. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local port.

Experiments use actual SDK and provider calls with normal usage charges. Run `npm run typecheck` and `npm test` for compilation and fixture configuration checks. The original infographic, instructor cover, source viewer and downloadable native evidence are included.

## Same proposed source edit

Every run creates an owned synthetic `lesson-title.txt` containing `Draft MCP lesson.` or the Hooks variant, with a trailing newline. The task reads it and proposes replacing Draft with Reviewed while preserving the topic and newline.

- **Plan** uses `permissionMode: 'plan'`. The actual task writes the native runtime's designated plan artifact while preserving the classroom source file. The app shows the first 12 lines and preserves the complete plan in its report.
- **Automatically approve edits** uses `permissionMode: 'acceptEdits'`. The actual native Edit changes the classroom source title. The app reads the real source file afterward and verifies the exact reviewed text.
- **acceptEdits with a scoped deny** adds the inline deny rule `Edit(./lesson-title.txt)`. The actual native Edit is denied, and the source file retains its original contents.

Read, Edit and Write remain selected in every configuration. Write supports the runtime's designated plan file. The task uses Edit for the classroom source change. Repeating automatic edits after the denied configuration starts a fresh owned comparison run with the scoped deny removed.

## Native planning behavior

Plan mode permits its protected planning artifact. Ordinary source-file edits in plan mode reach the host approval callback under the documented native behavior. This task requests a plan while planning and preserves its source. The host denies any operation that still needs review. The report records actual callback invocations and source changes.

The tool hook admits operations on the runtime's `.md` plan files inside this run's `native-config/plans` directory. It also admits one exact classroom Read and one exact source Edit. Equivalent full-line and title-only replacements both preserve the actual trailing newline. Valid requests return an empty hook result, leaving native permission rules active. Additional or unrelated operations receive a hook denial.

In the pinned runtime, the scoped source-file deny returns its actual path-denial error before the Edit hook. The app preserves the actual native request and result and verifies the unchanged file independently.

## Evidence and exercise

Reports preserve actual initialized tools, requested modes and rules, calls and replies, hook requests, approval callback records, complete plan artifacts, original and final source text, native session identifier and final checks. Runtime reports redact the configured API key and are stored under `runs/`. A fresh server process starts a new download index.

Run `npm run agent -- plan MCP`, `npm run agent -- accept-edits MCP`, or `npm run agent -- edits-denied Hooks` for actual JSON evidence. Failed verification returns a nonzero exit code.

For the exercise, use Hooks. Compare the actual plan artifact, reviewed source file under automatic editing and preserved original under the scoped deny. Explain the observed tool replies and actual file contents for each case.

The student archive includes source, tests and original assets. Runtime artifacts, secrets, dependency folders and teacher recordings are excluded.

## Reference

The official permission guide describes plan files, review callbacks, automatic file edits and scoped Edit rules. [Claude Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
