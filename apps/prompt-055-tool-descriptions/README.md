# Prompt 55 · Tool descriptions and observed selection quality

Compare actual model-selected tools before and after improving their descriptions. The application records real SDK queries and checks selected routes against labelled classroom questions.

## Run locally

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env` and configure your own Anthropic API key. Run `npm start`, then open `http://127.0.0.1:43155`.

The lesson was verified with Node.js 24.14.1, Agent SDK 0.3.322, bundled Claude Code 2.1.322 and Zod 4.6.7. Run `npm run typecheck` and `npm test`. Run `npm run agent -- vague core`, `npm run agent -- specific core` or `npm run agent -- specific holdout` for actual CLI evaluations.

## Controlled description comparison

Two similar custom tools have the fixed local names `lookup_record_a` and `lookup_record_b`, the same query input shape and read-only handlers. One returns local invoice fixture facts, and the other returns local cancellation-policy fixture facts. These generic names keep the description comparison focused on the changed wording.

The vague mode gives both tools the same description. The specific mode explains the domain, useful question types and the boundary with the other tool. Tool names, handlers, input schema, query instructions and labelled question set remain fixed across this comparison.

Each question runs in a fresh actual SDK session. The prompt includes the question and asks the agent to choose one available record tool from its descriptions. Expected route labels are used by the host after execution. They are absent from the model prompt. A pre-tool hook permits one exact question lookup through either registered tool.

The host records the selected tool from actual handler execution. Native result and final structured output must preserve that handler's source and facts. Checks also establish actual discovery of both tools, handler process identity and native server source `sdk`. The selected route is then compared with the labelled expected route.

## Actual mistake and recovery

The initial four-question vague-description run produced three correct choices. Its general pre-session cancellation question was routed to the invoice handler. The recorded native tool execution and returned invoice facts preserve this actual mistake. The lesson explicitly restores that saved observed run for its mismatch chapter.

The initial specific-description run produced four correct choices on the same core questions. Browser verification also tests a separate two-question held-out suite. The app reports the score for each actual run. Repeated vague-description runs can produce different selections. A four-question score describes that sample, and broader reliability requires a larger evaluation set and repeated trials.

## Explore and inspect

Run the vague core suite and inspect each observed and expected route. Switch to specific descriptions and run a fresh core suite. Select the held-out questions for another actual evaluation. Add labelled questions in `src/descriptions.ts`, improve the wording and compare fresh observed scores.

The outcome panels show actual supplied descriptions, observed routes and a returned fixture result. If a run contains a mismatch, its first mismatched question and actual returned facts appear in the result panel. Expand preserved native evidence or download the full report for every trial, handler execution, native message, session identifier, check and final output.

Fixture invoice amounts and cancellation rules are local teaching data. Each core suite makes four paid model queries, and the held-out suite makes two. Each query has a ninety-second abort and a 0.50 USD SDK budget. The HTTP app serializes suites, and the query and server close after each trial. Reports remain local under `runs/`, and the download index clears on restart.

The original infographic and approved author-photo cover are included with provenance.

## References

- [Custom tool names, descriptions and handlers](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)

Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and final editorial presentation before release.
