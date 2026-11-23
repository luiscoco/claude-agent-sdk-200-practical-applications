# Prompt 75 · Advanced native permission modes

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43175`. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local port.

Experiments use actual SDK and provider calls with normal usage charges. Run `npm run typecheck` and `npm test` for compilation and configuration checks. The app includes the original infographic, instructor cover, source viewer and downloadable native evidence.

## Disposable classroom workspace

Each run creates a fresh owned directory under `runs/` containing one synthetic input note. The task reads that note and requests an exact Write to its classroom report file. The selected native tools are Read and Write.

Isolation in this example is enforced by selected file tools, native outside-working-directory read and write guards, and a host hook that admits one exact owned Read and Write with the expected content. Valid calls return an empty hook result, preserving native permission evaluation. Unexpected paths, contents or additional operations receive a hook denial.

## Actual mode comparisons

- **Auto** requests `permissionMode: 'auto'`. Native initialization records the active mode, the actual classroom Write completes and the output file contains the exact note text.
- **Auto with ask** keeps auto and adds `Edit(./classroom-report.txt)` to the explicit ask rules. This scoped Edit rule governs the Write operation. The actual request reaches the host callback, which denies it. The native result records the denial and the output file is absent.
- **Bypass** requests `permissionMode: 'bypassPermissions'` with its required `allowDangerouslySkipPermissions` option. The exact owned Write completes with zero host callback requests.
- **Bypass with ask** adds the same explicit ask rule. The actual request still reaches the host callback and receives the classroom denial.

The report verifies the native initialized permission mode and preserves subsequent mode changes. A session that falls back to another mode fails verification. Auto mode availability depends on the provider, model and account configuration. The pinned Anthropic classroom runs used the configured Sonnet 4.6 model successfully.

The official reference describes classifier review for eligible actions in auto mode. This experiment measures the actual active mode, native Write outcome and explicit ask-rule behavior.

The SDK emits its callback-shadowing warning for bypass mode. The explicit ask comparison preserves actual callback evidence under that same mode.

## Evidence and exercise

Reports include requested and actual native modes, settings, initialized tools, exact requests and replies, hook and host callback records, real file contents, final structured output and checks. Runtime reports redact the configured API key and are stored under `runs/`. A new server process starts a new download index.

Run `npm run agent -- auto MCP`, `npm run agent -- auto-ask MCP`, `npm run agent -- bypass Hooks`, or `npm run agent -- bypass-ask Hooks` to inspect actual JSON evidence. Failed verification returns a nonzero exit code.

For the exercise, use Hooks. Compare actual active modes, Write results and file contents. Add the explicit ask rule in each mode and inspect the real host callback denial. Explain the preserved native outcomes within the classroom file boundary.

The student archive includes source, tests and original assets. Runtime artifacts, secrets, dependency folders and teacher recordings are excluded.

## References

The official guide describes advanced mode behavior, eligibility and explicit permission rules. [Claude Code permission modes](https://code.claude.com/docs/en/permission-modes)

The SDK guide documents callback evaluation and scoped Edit rules that govern file-writing tools. [Claude Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
