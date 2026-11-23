import asyncio
import importlib.metadata
import json
import os
import sys
import tempfile
from contextlib import aclosing
from datetime import datetime, timezone
from pathlib import Path

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    HookMatcher,
    ResultMessage,
    SystemMessage,
    ToolResultBlock,
    ToolUseBlock,
    UserMessage,
    query,
)
from pydantic import ValidationError
from calculator import (
    CalculatorInput,
    Outcome,
    create_calculator_server,
    native_outcome,
)


async def run_calculator(value):
    try:
        requested = CalculatorInput.model_validate(value)
    except ValidationError as error:
        raise ValueError(
            "INVALID_INPUT · Select an operation and two finite operands from -1000000 through 1000000. "
            + str(error)
        ) from error
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise ValueError("MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.")
    requested_input = requested.model_dump()
    root = Path(__file__).resolve().parents[1]
    runs = root / "runs"
    runs.mkdir(exist_ok=True)
    workspace = tempfile.mkdtemp(prefix="calculator-", dir=runs)
    executions = []
    server = create_calculator_server(executions)
    tool_name = "mcp__calculator__calculate"
    calls = []
    tool_results = []
    hook_results = []

    async def permission(payload, _tool_id, _context):
        try:
            parsed = CalculatorInput.model_validate(payload.get("tool_input"))
            allowed = (
                payload.get("tool_name") == tool_name
                and parsed.model_dump() == requested_input
            )
        except ValidationError:
            allowed = False
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow" if allowed else "deny",
            }
        }

    async def observe(payload, _tool_id, _context):
        hook_results.append(
            {
                "event": payload.get("hook_event_name"),
                "mcpServer": payload.get("mcp_server"),
                "response": payload.get("tool_response"),
                "error": payload.get("error"),
            }
        )
        return {}

    options = ClaudeAgentOptions(
        cwd=workspace,
        model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6"),
        tools=[],
        mcp_servers={"calculator": server},
        allowed_tools=[tool_name],
        setting_sources=[],
        max_turns=5,
        max_budget_usd=0.75,
        output_format={"type": "json_schema", "schema": Outcome.model_json_schema()},
        system_prompt="Call the registered Python calculator with the exact requested arguments. Preserve its actual outcome, including any domain error. The host records the in-process handler execution and compares it with the native result and final structured outcome.",
        hooks={
            "PreToolUse": [HookMatcher(matcher=tool_name, hooks=[permission])],
            "PostToolUse": [HookMatcher(matcher=tool_name, hooks=[observe])],
            "PostToolUseFailure": [HookMatcher(matcher=tool_name, hooks=[observe])],
        },
    )

    prompt = (
        "Use "
        + tool_name
        + " exactly once with the exact arguments "
        + json.dumps(requested_input, allow_nan=False)
        + ". Preserve the actual tool result or domain error and return that same outcome as structured output. Division by zero is a deliberate classroom error case."
    )
    success = False
    session_id = ""
    initial_tools = []
    native_version = ""
    raw_output = None
    result_status = ""
    result_errors = []
    error = ""
    try:
        async with aclosing(query(prompt=prompt, options=options)) as messages:
            async for message in messages:
                if isinstance(message, SystemMessage) and message.subtype == "init":
                    initial_tools = message.data.get("tools", [])
                    native_version = message.data.get("claude_code_version", "")
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, ToolUseBlock):
                            calls.append(
                                {
                                    "id": block.id,
                                    "name": block.name,
                                    "input": block.input,
                                }
                            )
                if isinstance(message, UserMessage) and isinstance(
                    message.content, list
                ):
                    for block in message.content:
                        if not isinstance(block, ToolResultBlock) or not any(
                            call["id"] == block.tool_use_id
                            and call["name"] == tool_name
                            for call in calls
                        ):
                            continue
                        tool_results.append(
                            {
                                "toolUseId": block.tool_use_id,
                                "isError": bool(block.is_error),
                                "content": block.content,
                                "parsedOutcome": native_outcome(block.content),
                                "contentType": (
                                    "text-blocks"
                                    if isinstance(block.content, list)
                                    else "text"
                                ),
                            }
                        )
                if isinstance(message, ResultMessage):
                    success = message.subtype == "success" and not message.is_error
                    raw_output = message.structured_output if success else None
                    session_id = message.session_id
                    result_status = message.subtype
                    result_errors = (
                        []
                        if success
                        else message.errors or [message.result or message.subtype]
                    )
    except Exception as failure:
        error = str(failure)
    output = None
    try:
        output = Outcome.model_validate(raw_output).model_dump()
    except ValidationError:
        pass
    execution = executions[0] if executions else None
    checks = {
        "handlerInputMatches": bool(execution)
        and all(item["input"] == requested_input for item in executions),
        "inProcessHandlerObserved": bool(execution)
        and all(item["processId"] == os.getpid() for item in executions),
        "nativeResultMatches": bool(execution)
        and any(
            result["parsedOutcome"] == execution["outcome"]
            and result["isError"] == (not execution["outcome"]["ok"])
            for result in tool_results
        ),
        "finalResultMatches": bool(execution) and output == execution["outcome"],
        "sdkServerObserved": any(
            isinstance(result["mcpServer"], dict)
            and result["mcpServer"].get("name") == "calculator"
            and result["mcpServer"].get("source") == "sdk"
            for result in hook_results
        ),
    }
    secret = os.environ.get("ANTHROPIC_API_KEY")
    if secret:
        error = error.replace(secret, "[REDACTED]")
        result_errors = [
            message.replace(secret, "[REDACTED]") for message in result_errors
        ]
    return {
        "requestedInput": requested_input,
        "workspace": workspace,
        "toolName": tool_name,
        "executions": executions,
        "hostProcessId": os.getpid(),
        "calls": calls,
        "toolResults": tool_results,
        "hookResults": hook_results,
        "initialTools": initial_tools,
        "nativeVersion": native_version,
        "pythonVersion": sys.version.split()[0],
        "sdkVersion": importlib.metadata.version("claude-agent-sdk"),
        "pydanticVersion": importlib.metadata.version("pydantic"),
        "rawOutput": raw_output,
        "output": output,
        "checks": checks,
        "success": success,
        "error": error,
        "resultStatus": result_status,
        "resultErrors": result_errors,
        "sessionId": session_id,
        "verified": not error and success and all(checks.values()),
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }


async def run_with_timeout(value):
    return await asyncio.wait_for(run_calculator(value), timeout=90)
