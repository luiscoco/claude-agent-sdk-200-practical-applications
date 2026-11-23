# Prompt 45 · Targeted source edits and real diffs

Apply an actual native Read/Edit operation to a TypeScript source working copy. Verify the exact one-line replacement, capture a real Git diff and execute the imported source before and after the edit.

## Setup

Use Node.js 22 or later and install Git so the git command is available on PATH. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43145. Run `npm run agent -- edit 550` or `npm run agent -- stale 550` for the CLI. Run `npm run typecheck` and `npm test` for offline checks.

## Precise native edit and source preservation

Every experiment creates a fresh runs/edit-* working directory with pricing.ts and an independently stored before.ts snapshot. The classroom fixture defines MAX_DISCOUNT_CENTS as 500. The requested targeted replacement changes that exact line to 600. The query enables native Read and Edit, asks the agent to read its working source, perform the supplied replacement and inspect the resulting file.

The actual message loop records Read/Edit inputs and matched native results by tool-use ID. A scoped callback and PreToolUse hook permit reading the classroom workspace and editing its pricing source. The original fixture remains the template for new experiments.

Independent verification compares the entire resulting source with the original text after exactly the specified replacement. Source bytes outside that intended replacement match the original, including validateDiscount, the separate formatLessonTitle function and author comment. The report preserves before/after source text, raw byte count and SHA-256.

## Real diff and actual edited function execution

The application executes Git with --no-index, --no-ext-diff, no pager and no color against before.ts and pricing.ts in the working directory. The displayed diff is actual stdout from that command. Exit status 1 identifies a difference and is handled as expected diff output. Exit status 0 identifies equal files. Other command failures retain their actual error and stderr.

probePolicy dynamically imports the actual working source using its content hash in the module URL, then calls its exported validateDiscount function with the selected discount and a 1000-cent subtotal. The original 500-cent policy rejects a 550-cent discount with DISCOUNT_LIMIT_500. The actual edited 600-cent policy accepts 550. Both results are preserved from executed source modules. A 400-cent input is accepted by both versions. The input supports integer discounts from 0 through 1000 cents.

The source viewer displays actual before/after code and the unified diff. The classroom amounts are euro cents. Downloads provide the actual working pricing.ts, exact Git stdout as pricing.patch and the observed JSON report.

## Genuine stale-excerpt failure and recovery

Stale mode deliberately supplies an old_string containing limit 450, which is absent from the actual source. The model reads the source and attempts that exact stale excerpt through native Edit. The actual tool reports String to replace not found in file. Verification requires that native stale-excerpt error, no successful Edit result, identical before/after source, the original policy limit and a zero-status empty Git diff.

Restore the current excerpt and run a fresh experiment. Native Edit performs the exact 500-to-600 replacement, the real diff shows that line change, and the executed function accepts the default 550-cent test. Earlier working copies retain their own separate paths.

Browser checks verify actual native tools, exact source preservation, Git diff lines, executed before/after behavior, genuine stale failure, recovery, a 400-cent input, invalid/empty input rejection, source and diff downloads, JSON evidence and responsive width. The offline regression check executes the same source module before/after a precise replacement and runs actual Git comparison.

Each query has a 90-second abort timeout, six agent-loop turns and a USD 0.75 SDK budget limit. Read and Edit are the enabled built-in tools. MCP servers and filesystem setting sources are empty. finally clears the timer and closes the query. The local server permits one experiment at a time and stores observed reports under runs.

## Exercise

Change the intended source replacement and inspect its actual diff. Execute the imported source with another discount, compare before/after behavior and verify the complete source against the expected replacement. Reproduce the stale excerpt, inspect the native error, restore the current excerpt and download the repaired source and patch.

The original infographic and photo cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK TypeScript tools and messages](https://code.claude.com/docs/en/agent-sdk/typescript)
- [SDK tool permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- [Git diff documentation](https://git-scm.com/docs/git-diff)
