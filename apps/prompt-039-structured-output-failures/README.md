# Prompt 39 · Structured-output failures

Run actual Claude Agent SDK experiments for exhausted structured-output retries, a successful text result with absent structured data, a one-turn limit and a repaired schema. Preserve the native result before the single-shot iterator can throw, and gate typed application use on the complete success checks.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally. Run `npm start` and open http://127.0.0.1:43139. Run `npm run agent -- exhausted` for the CLI. Other modes are missing-output, turn-limit and repaired. Run `npm run typecheck` and `npm test` for offline regression checks.

## Genuine retry exhaustion

The classroom exhausted schema is valid JSON Schema with contradictory count limits, minimum 1 and maximum 0. Its required integer has no satisfying value. The actual model calls the native StructuredOutput tool repeatedly. The application retains the actual tool inputs and matched validation results. The pinned runtime recorded five rejected attempts, a native error_max_structured_output_retries result with its errors list, and terminal_reason structured_output_retry_exhausted. The actual single-shot iterator then threw an exception describing that error result.

The five-attempt observation belongs to the recorded bundled runtime. The application branches on the native error subtype and preserves the observed attempts. It does not configure or assume a public retry-limit option.

The code saves nativeResult inside the message loop before handling the following exception. The report therefore retains both pieces of native evidence. finally clears the timeout and closes the query.

## Successful text and unsuccessful native results

Missing-output mode deliberately leaves out outputFormat and requests plain text COUNT 2. The actual run succeeds without a structured_output property. The application guard classifies this as missing_output and withholds the typed consumer.

Turn-limit mode requires the agent to read fixtures/count.txt with the native Read tool before producing its structured answer. A one-turn agent-loop limit ends that actual run with error_max_turns after Read. Its result, errors and following iterator exception are retained. Read is the only built-in tool enabled for this scenario. Other scenarios have no built-in tools. MCP servers and filesystem setting sources are empty.

inspectResult checks for no result, exhausted retries, other unsuccessful subtypes, is_error on a success subtype, absent structured_output, and invalid application data. The strict CountSchema validates any successful structured candidate. Unit fixtures exercise all guard branches. Browser and video demonstrations use real SDK messages.

## Repair and typed use

Repaired mode supplies a satisfiable draft-07 schema and enough turns. The native structured object returns count 2. After success, absence of is_error, runtime parsing and absence of an iterator exception, consumeCount produces countPlusOne 3. The interface and report show this actual application result.

Each experiment has a 120-second abort timeout and a USD 1 SDK budget limit. The server accepts one experiment at a time and stores observed reports under runs. Download the schema, prompt, native result, actual tool attempts and errors, guard classification, iterator exception and typed output from the interface.

## Exercise

Reproduce the contradictory schema, inspect the native error result and its following iterator exception, then repair its limits. Compare the successful plain-text run with a valid structured run. Confirm that only validated structured success calls the typed consumer.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [SDK structured-output error handling](https://code.claude.com/docs/en/agent-sdk/structured-outputs#error-handling)
- [SDK result message types](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Zod runtime parsing](https://zod.dev/basics)
