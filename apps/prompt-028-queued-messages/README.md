# Prompt 28 · Queued messages

Queue multiple real SDK user messages and verify yield order, native turn boundaries, and result-to-message mapping.

## Setup and execution

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43128.

Run `npm run agent -- rapid`, `npm run agent -- paced`, or `npm run agent -- duplicate` for the CLI. Run `npm run typecheck` and `npm test` for the offline checks. Dependency versions are pinned in package-lock.json.

## Queue and native results

Each run prepares three new UUIDs for items A, B, and C. Their expected arithmetic answers are independently computed as 2, 4, and 6. MessageQueue is an application FIFO implementation whose async generator yields documented SDKUserMessage objects. One real query consumes that AsyncIterable.

Rapid mode submits all three items before creating the query. Paced mode submits the next item when the output loop receives a native result. The report records actual yielded UUIDs and each result's user_message_uuids, with user_message_uuid as a compatibility fallback. Native input batching can group several queued messages into one result. The interface displays the observed group count and coverage for each run.

The verifier compares FIFO yield order and ordered native result coverage with the original UUID list, checks every covered item's answer against its independent expected value, and confirms that the native session ID stays consistent. It preserves the actual result subtype and is_error field. The verifier requires complete coverage of all three inputs.

The recorded CLI rapid experiment produced two native result groups, with A in the first and B/C in the second. The paced experiment produced three groups. Group counts are observations from those runs. The application checks actual coverage on every execution.

## Deliberate error and recovery

Duplicate mode intentionally reuses A's UUID for B. The application's validateItems guard raises DUPLICATE_MESSAGE_ID before SDK query creation. This is a classroom application validation rule. The SDK receives zero messages in this scenario. Restore unique UUIDs and run a fresh rapid or paced experiment.

Each SDK run has a 120-second abort timeout, a four-turn loop limit, and a USD 0.50 SDK budget limit. Built-in tools, MCP servers, and filesystem setting sources are empty. The finally block ends the input queue and closes the query. Reports are saved locally under runs and can be downloaded from the interface. The server accepts one active experiment at a time.

## Exercise

Compare rapid and paced runs. Trace each UUID through input, generator yield, and native result coverage. Explain any multi-message result group using the actual report. Change the item calculations and update the independent verifier together. Reproduce the duplicate guard and restore distinct IDs.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [TypeScript SDK query and messages](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Conversation sessions](https://code.claude.com/docs/en/agent-sdk/sessions)
