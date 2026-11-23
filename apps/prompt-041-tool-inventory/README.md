# Prompt 41 · Inspect the actual tool inventory

Inspect a real Claude Agent SDK session's native initialization, derive a capability report from its actual tool names, and check availability before selecting a Read example.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43141. Run `npm run agent -- scoped` or `npm run agent -- none` for the CLI. Run `npm run typecheck` and `npm test` for offline checks.

## Native inventory before example selection

The first query requests a brief INVENTORY_READY acknowledgement and records the actual system init message's tools, session ID, native runtime version and model. Scoped mode configures Read, Glob and Grep. Empty mode configures an empty built-in tool set. The capability report iterates only over the tool names reported by native initialization. Its display descriptions cover the three classroom tools, and an unfamiliar reported tool retains its own name with a generic availability description.

The actual recorded scoped inventory contains Read, Glob and Grep. The actual empty inventory has no available tools. The first query finishes and closes before the user selects the example. The report retains its requested configuration separately from its observed native tool list.

## Availability guard and real execution

Run Read example checks the server-owned successful inventory with requireTool. An unavailable Read produces TOOL_UNAVAILABLE and returns before a second SDK query starts. Its report preserves sdkStarted false and an empty observed tool-call list. The browser records this actual application guard with the real empty inventory.

For an available Read, a new query scopes its built-in tools to Read, reads fixtures/lesson-total.ts and summarizes the actual function, example total and verification marker. The report preserves the new session's actual tool inventory and Read call. Its answer must include calculateLessonTotal, the example total 40 and INVENTORY-041. The fixture's source is also available in the app's source viewer.

Restore file tools, inspect a fresh native inventory, and execute the Read example to recover. Browser checks verify a fresh inspection session ID, actual file-tool execution, report restoration, downloads, invalid configuration rejection, and responsive width. The server rejects execution requests without a successful inventory ID.

The inspection and example are separate real sessions. The initial session discovers the configured tools, and the example session independently records its selected tool inventory. Every query has a 90-second abort timeout. Inventory inspection has one agent-loop turn and a USD 0.25 budget limit. The Read example has four turns and a USD 0.50 budget limit. MCP servers and filesystem setting sources are empty. finally clears the timeout and closes each query.

The local server permits one experiment at a time and stores observed reports under runs. Download the actual initialization, capability report, availability guard, example tool calls and verified source answer.

## Exercise

Change the configured tool set and inspect its actual native initialization. Derive capabilities from the returned names, require the selected example tool, and inspect its real execution evidence. Reproduce an unavailable Read and recover through a fresh scoped inventory.

The original infographic and photo cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK TypeScript initialization and tools](https://code.claude.com/docs/en/agent-sdk/typescript)
- [SDK tool permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
