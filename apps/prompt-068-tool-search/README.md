# Prompt 68 · Deferred tool search and actual context measurements

Author: Luis Coco Enríquez

## Run

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and set your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43168`.

`CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` changes the local web port. Experiments run real SDK tasks, native context probes and model tool calls, with normal provider usage. Run `npm run typecheck` and `npm test` for compilation and direct MCP regression checks.

The application includes its original infographic, instructor cover, actual source viewer, same-lesson measurement table and downloadable native evidence.

## Classroom catalog and settings

The stdio catalog server publishes 48 synthetic lesson tools with deliberately verbose descriptions, producing a measurable schema budget for the threshold experiment. Its separate core server exposes a short readiness tool with `alwaysLoad: true`. Catalog schemas use `alwaysLoad: false`.

Each actual query uses a fresh native configuration directory and performs the same core check plus one requested lesson lookup. The host configures `ENABLE_TOOL_SEARCH` explicitly.

- **Low threshold** sends `auto:1`. In the tested pinned runtime, this activates deferred catalog discovery. The actual model calls `ToolSearch` and invokes the discovered lesson tool.
- **High threshold** sends `auto:100`. This classroom catalog loads upfront, with zero actual search calls.
- **Disabled** sends `false`. Catalog schemas load upfront, with zero actual search calls.

The permission hook admits the exact core and requested lesson arguments once each. It denies additional or unrelated MCP attempts. The verifier compares native results with actual server process events and the expected synthetic lesson output.

## Context classification

The host holds the user task until both servers connect and a native `getContextUsage({detail: 'full'})` probe completes. It then submits one actual task and captures a second full native context snapshot after the SDK result.

Used schema totals come from category `id: 'mcp_tools'`, `kind: 'used'`. Deferred schema totals come from `id: 'mcp_tools_deferred'`, `kind: 'deferred'`. This classification also works with localized category labels.

In the pinned runtime, the raw catalog `isLoaded` flags can remain false during upfront loading even though the full MCP category counts the schemas as used. The app preserves those raw flags and uses category identifiers and kinds for budget totals. A regression test covers this observed case.

The initial low-threshold prototype recorded 46 used MCP schema tokens and 20,112 deferred schema tokens. After discovering lesson 17 it recorded 465 used and 19,693 deferred. The upfront prototypes recorded 20,142 used MCP schema tokens. These are observations from this synthetic catalog and installed version. Each app run retains its own actual values.

## Timing and comparison

Task wall time starts after the initial full context probe and stops at receipt of the actual SDK result, before the final full context probe. The report separately records raw SDK duration, SDK API duration, summed context probe wall time and instrumented total wall time.

The comparison table shows the latest actual run per mode for the selected lesson during the current server process. It retains short run identifiers. Individual timings reflect model execution, caching and network variation. Repeated runs provide additional observations for a controlled comparison.

Reports include full snapshots, model usage, actual search calls, handler inputs and outcomes, native session identifiers and checks. Runtime report redaction checks the exact configured API key value. Local artifacts are written under `runs/`. A fresh server process starts new comparison and download indexes.

## CLI and exercise

Run `npm run agent -- low-threshold 17`, `npm run agent -- high-threshold 17`, or `npm run agent -- disabled 17` for actual JSON evidence. An unsuccessful verification returns a nonzero exit code.

For the exercise, measure lesson 18 under all three settings. Verify its five-minute result against the actual handler outcome. Compare native schema categories, actual search calls and recorded timing boundaries.

The student archive includes source, tests and original assets. Runtime artifacts, credentials, dependency folders and teacher recordings are excluded.

## Reference

The official documentation describes explicit search settings and always-loaded tool behavior. The lesson uses the installed pinned SDK and native runtime. [Claude Agent SDK tool search](https://code.claude.com/docs/en/agent-sdk/tool-search)
