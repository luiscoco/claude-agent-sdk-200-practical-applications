# Prompt 23 · Message types

Handle documented system, assistant, user, tool-result, and final-result structures from a real Claude Agent SDK session.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, configure your Anthropic API key locally, then run `npm start`. Open http://127.0.0.1:43123.

Run `npm run agent` for the permitted Read or `npm run agent -- --denied` for the classroom permission-denial experiment.

## Typed message handling

src/messages.ts accepts the installed SDKMessage discriminated union. System messages include native initialization. Assistant content contains text and tool_use blocks. User content can contain ordinary text or tool_result blocks. Result messages provide final completion status and result text or errors. Other SDK message types are ignored by this focused viewer.

The UI preserves the actual SDK frame number and outer message type for every displayed content item. One assistant frame may contain multiple content blocks. Tool results retain their user wrapper, tool_use_id, content, and is_error flag. The correlation panel connects each result to the earlier request through its actual identifier.

The permitted experiment reads fixtures/course.txt and reports its Session marker. The denied experiment requests fixtures/restricted.txt. The application permission policy supplies an actual denial, and the model is asked to report that observation and finish. The report preserves both the tool error and the final SDK result. Each query allows four turns and a USD 0.20 SDK budget.

The application verifies the marker for the successful Read, the expected tool-result error flag for the denied Read, a successful final completion, and request/result ID ordering. Filter the same recorded report by System, Assistant, User, Tool results, and Final result to inspect how those structures relate. Each filter operates on actual observed content from that report.

Tool access is checked against the canonical course fixture path by canUseTool and a PreToolUse hook. The classroom permission-denial fixture makes this failure reproducible. The message viewer displays model text and tool content from the running query.

Run `npm test` to check typed user-message classification, tool-result IDs and error flags, and correlation with matching or absent requests. Run `npm run typecheck` to check the installed SDK declarations.

For practice, change the Session marker in the course fixture and run a fresh session. Trace the new value through the tool result, assistant answer, and final result. Compare the same actual tool result through the User and Tool results filters.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [SDK TypeScript message types](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Agent execution loop](https://code.claude.com/docs/en/agent-sdk/agent-loop)
