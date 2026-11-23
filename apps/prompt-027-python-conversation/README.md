# Prompt 27 · Python conversation

Build a real multi-turn Python conversation using ClaudeSDKClient and its documented query() and receive_response() methods.

## Setup

Use Python 3.10 or later. Create a local virtual environment with `python -m venv .venv` and install `requirements.txt` with that environment's Python and pip. Copy `.env.example` to `.env` and configure your Anthropic API key locally.

Run `.venv/Scripts/python.exe src/server.py` on Windows or `.venv/bin/python src/server.py` on macOS and Linux. Open http://127.0.0.1:43127. The application server and SDK implementation use Python.

Run the environment's Python with `src/cli.py` for the managed conversation or `src/cli.py unconnected` for the genuine SDK connection error. A failed client run returns CLI exit status 1. `requirements-lock.txt` records the dependency versions used during recording.

## Managed conversation

The code enters one `async with ClaudeSDKClient(options=options)` block. For each prompt it awaits client.query(), then iterates client.receive_response() until that iterator returns after its ResultMessage. It repeats that pair for all three user turns within the same managed client.

The actual responses store the classroom context, recall ORBIT, and calculate 150 from the earlier starting budget. Every result preserves the same native session_id. The report records the actual Python SDK message class names received for each response and verifies that each receive loop ends with ResultMessage.

The managed-client block completes before the application marks clientContextCompleted true. The SDK context manager handles its connection and disconnection. Each run has a 120-second asyncio timeout. Query options disable built-in tools, MCP servers, and filesystem settings and apply a four-turn agent-loop limit and a USD 1 SDK budget limit.

## Connection failure and recovery

The unconnected mode constructs an actual ClaudeSDKClient and calls query() before connecting. The recorded SDK raises CLIConnectionError with its Not connected diagnostic. The report preserves the exception type and message, zero completed turns, and a false managed-context completion flag. Restore the managed-client mode to execute the three real query/receive pairs again.

Run `python -m unittest discover -s tests -v` with the environment's Python for mode validation and the actual offline SDK connection guard. The live recording verifies the three model responses and native session continuity.

For practice, edit the classroom prompts to store a fact of your own and ask a follow-up using it. Add another query/receive_response pair and inspect its actual session ID and final message boundary. Keep the operation inside the managed client block.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [Python client and response receiving](https://code.claude.com/docs/en/agent-sdk/python)
- [Managed multi-turn Python client](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Streaming input and response boundaries](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
