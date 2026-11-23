# Prompt 37 · Pydantic integration

Define a Python result model with Pydantic and validate the real SDK structured output before using the validated model in application logic.

## Setup

Use Python 3.10 or later. Create a local virtual environment with `python -m venv .venv` and install requirements.txt with that environment's Python and pip. Copy `.env.example` to `.env` and configure `ANTHROPIC_API_KEY` locally.

Run `.venv/Scripts/python.exe src/server.py` on Windows or `.venv/bin/python src/server.py` on macOS and Linux, then open http://127.0.0.1:43137. The server and SDK integration use Python.

Run the environment's Python with `src/cli.py valid basics` or `src/cli.py corrupt-boundary` for the CLI demonstrations. Run `python -m unittest discover -s tests -v` with the environment's Python for the offline tests. Dependencies pin claude-agent-sdk 0.2.180, Pydantic 2.14.3, and python-dotenv 1.2.4. requirements-lock.txt records the complete environment.

## Model, generated schema, and real output

Workshop is a Pydantic BaseModel with strict validation and forbidden extra fields. It defines a nonempty title, an integer duration_minutes from 1 to 120, a nonempty prerequisite list, and a publication boolean.

Workshop.model_json_schema generates the actual schema passed through ClaudeAgentOptions.output_format. The flat schema uses keywords supported by the pinned SDK runtime. The application supplies independently prepared workshop facts and receives the actual ResultMessage. It preserves structured_output after successful completion, along with the native session ID and runtime versions.

Workshop.model_validate then validates the runtime candidate. A successful validated Workshop instance supplies consume_workshop, whose annotated parameter exposes the typed model fields. The application adds a five-minute break numerically, joins prerequisites, and derives a publication label. The real Basics result produces 30 minutes including the break, and the Streaming result produces 45.

## Deliberate boundary error and recovery

Corrupt-boundary mode copies the successful native object and intentionally converts duration_minutes to a string. The original SDK output remains preserved. Strict Pydantic validation raises its actual int_type issue at duration_minutes. The application preserves ValidationError.errors, withholds its typed consumer, and leaves the application output null.

Restore the valid boundary and run another real structured query. The numeric duration passes model_validate, and the typed consumer executes. Browser checks verify the raw native facts, actual rejected candidate, withheld typed use, generated schema display, repaired 45-minute calculation, report download, and mobile layout. Unit tests check strict rejection, forbidden extra fields, original-data preservation, and typed numerical use.

The recorded environment used Python 3.12.15, Python SDK 0.2.180, Pydantic 2.14.3, and native runtime 2.1.321. The report records those observed versions. Each query has a 90-second asyncio timeout, a four-turn agent-loop limit, and a USD 0.50 SDK budget limit. Tools, MCP servers, and filesystem setting sources are empty. The SDK query iterator owns its connection lifecycle.

The server allows one active experiment and stores reports locally under runs. Reports preserve generated schema, native output, boundary candidate, parsed model data, actual Pydantic issues, typed consumer status, and application result.

## Exercise

Change a Pydantic field constraint, inspect model_json_schema, and run another native structured query. Validate the returned object before consuming its model fields. Reproduce the string duration error, inspect its actual issue location and type, then restore numeric input and confirm the application calculation.

The original infographic and branded cover are reused. Author: Luis Coco Enríquez.

## References

- [Pydantic models and model_validate](https://docs.pydantic.dev/latest/concepts/models/)
- [Pydantic strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/)
- [SDK structured outputs with Pydantic](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
