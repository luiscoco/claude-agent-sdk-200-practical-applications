# Prompt 26 · TypeScript conversation

Build a real multi-turn conversation using one query() call and an asynchronous stream of SDKUserMessage objects.

## Setup

Use Node.js 22 or later. Run `npm ci`, copy `.env.example` to `.env`, configure your Anthropic API key locally, then run `npm start`. Open http://127.0.0.1:43126.

Run `npm run agent` for the three-turn command-line demonstration. It stores a course codename and starting budget, recalls the codename, and calculates an updated budget from the earlier context. The CLI closes its query and waits for its consumer to finish.

## Persistent input flow

Each Conversation instance owns one SDK query, a MessageQueue, an output consumer, and its completed turns. The async generator waits for another submitted message between user turns. The browser sends one message and awaits its result before sending the next.

Each user message receives an application-generated UUID and a human origin marker. The native result echoes that UUID through user_message_uuid or user_message_uuids. The application records the actual echo and session_id and verifies correlation and a stable native session across completed turns.

The classroom messages store ORBIT and a starting lesson budget of 120, ask for the codename, and add 30 to the earlier budget. The recorded real answers are STORED, ORBIT, and 150 in the same native SDK session. The text area also accepts your own messages.

The SDK query uses empty built-in tools, MCP servers, and filesystem setting sources, a four-turn agent-loop limit, and a USD 1 SDK budget limit. Each pending user message has a 120-second application timeout. The local API rejects a second pending message with TURN_BUSY. Queueing multiple pending messages is explored in its later lesson.

Close ends the input stream, rejects any pending waiter, and calls Query.close(). The server waits for the output consumer before returning its closed snapshot. A subsequent send reaches the actual SESSION_CLOSED guard. Start a new conversation to recover. Server shutdown closes all known conversations and awaits their consumers.

The browser restores actual server-side conversation snapshots across its views. New-conversation input is validated before the previous conversation is closed. A failed startup restores the previous conversation's current server snapshot. Each completed turn is saved to its own report file under runs. Completed snapshot turns are copied to preserve the recorded state.

The report's verification requires matched message IDs, one native session, and successful SDK results. Classroom recording checks also assert the expected answers. Custom answers remain actual model outputs for students to review.

Run `npm test` for queue wakeups, ordered delivery, draining, and end-of-input behavior. Run `npm run typecheck` to check the installed SDK declarations.

For practice, store a new fact, ask a follow-up using that fact, and compare the native session ID and result UUID echoes. Close the session, reproduce the closed-session guard, and start a fresh conversation.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [Asynchronous user-message input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [TypeScript query and result message fields](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Session context and identifiers](https://code.claude.com/docs/en/agent-sdk/sessions)
