# Prompt 43 · Find files and search contents

Use actual native Glob and Grep tools to locate TypeScript files and find discount-validation symbols. Inspect returned file paths, exact source lines, empty results, native malformed-regex errors and repaired searches.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43143. Run `npm run agent -- matches` for the CLI. Other modes are no-results and invalid-regex. Run `npm run typecheck` and `npm test` for offline checks.

## Actual discovery and content search

The query enables native Glob and Grep and asks the agent to run both against fixtures/project. Glob uses **/*.ts. Matching mode searches validateDiscount|MAX_DISCOUNT_CENTS with native Grep, content output and line numbers. The actual project has three TypeScript files and five matching source lines. The prompt specifies the ASCII -n property for line numbers. A parameter-name validation error can be corrected and retried with the same regex. The final Grep result determines search completion and failure, while hadSearchError preserves the earlier native error history. The malformed-regex classroom mode stops after its actual failed attempt. The message loop records the native initialization tool list, actual tool inputs and matched tool results by tool-use ID.

A structured result contains discovered files, matching file/line/code entries, a summary and error field. The application preserves the actual returned object and the native tool evidence. It independently reads the classroom project using Node to build a comparison snapshot and source viewer. That snapshot supplies the expected file list and exact regex-matching lines.

Native results can express files relative to the project, relative to the app working directory, or as absolute paths. normalizeSearch converts these supported representations to project-relative paths while preserving parsedData and rawOutput. The interface displays normalized paths. The independent verifier compares every discovered path and matching file/line/code entry with the snapshot. Source-code comparison trims surrounding line whitespace. File navigation uses only the captured classroom snapshot.

The source viewer can open a discovered file or a returned matching line. Inspect the actual validateDiscount declaration and MAX_DISCOUNT_CENTS policy in pricing.ts, then trace its import and use in checkout.ts.

## Empty results, actual regex failure and repair

No-results mode uses NO_SUCH_DISCOUNT_SYMBOL. The real Glob still discovers three files, and native Grep returns zero matches. The structured matches array is empty, the native search has no tool error, and the independent source comparison confirms the empty result.

Invalid-regex mode deliberately sends [ as the exact native Grep pattern. The actual tool rejects its unclosed character class. The report retains that native error result, the attempted pattern and an empty structured match list. The interface displays the native error and withholds source-match verification for this failed search.

Restore the valid regex and run a fresh real query. Its three files and five source matches pass the independent comparison. Download the original structured result, normalized paths, actual Glob/Grep calls and tool results, independent source snapshot, comparison flags and verified recovery.

Unit checks cover exact match comparison, missing matches, unsupported outside-project paths, relative/working-directory/absolute path representations, empty matches and invalid scenario inputs. Browser verification checks actual tools, source-line navigation, empty search, native regex failure, repaired results, downloads, invalid configuration rejection and responsive width.

Each query has a 90-second abort timeout, six agent-loop turns and a USD 0.75 SDK budget limit. Glob and Grep are the enabled built-in tools. MCP servers and filesystem setting sources are empty. finally clears the timer and closes the query. The local server permits one experiment at a time and stores observed reports under runs.

## Exercise

Add a TypeScript file and a new policy symbol. Run actual discovery and content search, inspect exact paths and source lines, and compare the result with the independent snapshot. Reproduce an empty search and malformed regex, then restore the valid pattern and verify the repaired results.

The original infographic and photo cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK TypeScript built-in tools and messages](https://code.claude.com/docs/en/agent-sdk/typescript)
- [SDK tool permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- [SDK structured output](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
