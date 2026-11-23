# Prompt 54 · Nested input schemas and handler defaults

Send nested arguments through an actual custom-tool call. Observe optional-field defaults, normalized data, a local classroom quote and handler-side validation failures.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your own Anthropic API key. Run `npm start` and open `http://127.0.0.1:43154`.

The lesson was verified with Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322 and Zod 4.6.7. Run `npm run typecheck` and `npm test`. Run `npm run agent` for a real default-order CLI query, or `npm run agent -- path/to/order.json` for your own input file.

## Actual schemas and execution

`src/order.ts` defines nested customer and address objects, an items array and optional shipping options. The application request and tool input shape enforce the broad structure and types. The actual callback invokes `evaluateOrder()`, which applies the stricter handler schema and its defaults.

Country defaults to `ES`. Shipping defaults to `standard`, and gift wrap defaults to `false`. Defaults work when the entire options object is omitted and when individual fields inside it are omitted. The handler normalizes customer and city whitespace. Quantities must be integers from 1 through 20, and a request must contain 1 through 5 items. The Spanish postal-code classroom check requires five digits.

The broad tool shape accepts numeric zero. The quantity-zero example therefore reaches the actual handler, where the positive-integer rule rejects it. Its native result carries `isError`, the lifecycle hook records `PostToolUseFailure` and the final structured outcome preserves `INVALID_ARGUMENTS` with the nested issue path. The postal-code example is also verified through a real handler call.

Every callback records its original input, actual outcome and process identifier. Checks compare requested and handler inputs, handler and host process IDs, native result and final structured output. The native hook identifies the orders server with source `sdk`. The query and in-process server close after consumption, and a ninety-second abort bounds each experiment.

## Classroom quote fixture

The local fixture prices the microphone at 7900 euro cents and the USB cable at 1200. Standard shipping costs 490, express shipping 890 and gift wrap 200. Two USB cables with omitted options produce 2890 cents. Express shipping with gift wrap produces 3490 cents. The handler returns a read-only quote.

## Reproduce and repair

Run the default input and inspect the normalized country and options. Select **Try quantity zero** and call the tool to observe the actual handler rejection. Select **Restore omitted defaults** and run a fresh successful request. Use **Use explicit options** for express shipping and gift wrap. Edit the JSON to test a malformed postal code or an individually omitted option.

The three outcome panels show normalized handler fields and concise native and final summaries. Expand the preserved evidence panel or download the report for complete requested inputs, handler executions, native messages, lifecycle events and final structured data. Reports remain local under `runs/`, and the download index clears on restart.

Actual inference requires network access and incurs provider charges. The original infographic and approved author-photo cover are included with provenance.

## References

- [Agent SDK custom tool inputs and optional parameters](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [Zod schema APIs](https://zod.dev/api)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
