# Prompt 52 · Python calculator with @tool

Define an actual Python calculator with the Agent SDK's `@tool` decorator, register its in-process MCP server and let the real agent call it. Compare the actual Python handler execution, native MCP tool outcome and final structured agent result.

## Run locally

The lesson was verified with Python 3.12.15, Claude Agent SDK 0.2.180, its bundled native Claude Code 2.1.321 and Pydantic 2.14.3. Create and activate a Python environment, then install the pinned dependencies with `python -m pip install -r requirements-lock.txt`.

Copy `.env.example` to `.env` and configure your own Anthropic API key locally. Run `python src/server.py` and open `http://127.0.0.1:43152`.

Select addition, subtraction, multiplication or division and provide finite operands between -1000000 and 1000000. The default request is 24 + 18. Strict Pydantic validation checks application input before the paid SDK query. The decorator receives the input model's JSON Schema, and the handler validates its arguments through the same model.

## Define and call the actual decorated tool

The `@tool` decorator supplies the calculator name, description, input schema and read-only annotations. Its asynchronous Python handler calculates the result, records the actual arguments, outcome, process ID and timestamp, then returns a JSON text block and the Python error flag.

For the pinned Python SDK 0.2.180, the callback error field is `is_error`. The installed SDK reads this field and converts it into the native MCP error outcome. The lesson verifies the actual native error flag and `PostToolUseFailure` event for division by zero. The native tool result carries the calculator JSON in text blocks.

The server is registered under `calculator`, giving the tool name `mcp__calculator__calculate`. `allowed_tools` pre-approves that registered tool. A `PreToolUse` hook checks the exact operation and operands. The query's built-in tools list is empty, and the output-format mechanism provides the structured-result formatter.

The application checks actual handler input, host and handler process IDs, native result JSON and final structured output. The native hook also reports the server name `calculator` and source `sdk`. The query context closes the SDK connection after consumption, and a ninety-second timeout bounds the experiment.

## Error and repair

Use **Try division by zero**, then run the tool. The actual Python handler returns `DIVISION_BY_ZERO` with `is_error: True`. The native tool result carries that error flag, and the agent preserves the same structured outcome. Use **Restore 24 + 18** and run a fresh successful request to obtain 42.

Results use Python floating-point arithmetic. Non-finite results return a domain error. Download the observed report to inspect actual execution, native metadata, source provenance, tool results and structured output. Reports remain local in `runs/`, and restarting clears the in-memory download index.

## Verify and explore

Run `python -m unittest discover -s tests`. Use `python src/cli.py add 24 18` or `python src/cli.py divide 24 0` for actual CLI queries. Real SDK inference requires network access and incurs provider charges.

For an exercise, run another operation and operands, compare all three actual result stages and inspect the native error flag for division by zero. Restore the successful request, download its evidence and open the decorator and handler source to add another classroom operation.

## References

- [Create and call custom Agent SDK tools](https://code.claude.com/docs/en/agent-sdk/custom-tools)
- [Agent SDK Python reference](https://code.claude.com/docs/en/agent-sdk/python)
- [Pydantic model and schema documentation](https://docs.pydantic.dev/latest/concepts/models/)
- Installed Python SDK 0.2.180 implementation of `tool()` and `create_sdk_mcp_server()`.

The original infographic and author-photo cover are included with provenance. Disclose AI-assisted course creation and synthetic narration in the Udemy course description. The instructor reviews accuracy and the final editorial presentation before release.
