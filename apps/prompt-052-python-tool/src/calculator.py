import json
import math
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from claude_agent_sdk import ToolAnnotations, create_sdk_mcp_server, tool
from pydantic import BaseModel, ConfigDict, Field


class CalculatorInput(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    operation: Literal["add", "subtract", "multiply", "divide"]
    left: float = Field(ge=-1000000, le=1000000, allow_inf_nan=False)
    right: float = Field(ge=-1000000, le=1000000, allow_inf_nan=False)


class Outcome(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    ok: bool
    result: float | None = Field(allow_inf_nan=False)
    errorCode: Literal["", "DIVISION_BY_ZERO", "NON_FINITE_RESULT"]


def calculate(value: CalculatorInput):
    if value.operation == "divide" and value.right == 0:
        return Outcome(ok=False, result=None, errorCode="DIVISION_BY_ZERO")
    if value.operation == "add":
        result = value.left + value.right
    elif value.operation == "subtract":
        result = value.left - value.right
    elif value.operation == "multiply":
        result = value.left * value.right
    else:
        result = value.left / value.right
    if not math.isfinite(result):
        return Outcome(ok=False, result=None, errorCode="NON_FINITE_RESULT")
    return Outcome(ok=True, result=0 if result == 0 else result, errorCode="")


def native_outcome(content):
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        text = "\n".join(
            block["text"]
            for block in content
            if isinstance(block, dict)
            and block.get("type") == "text"
            and isinstance(block.get("text"), str)
        )
    else:
        return None
    try:
        return Outcome.model_validate(json.loads(text)).model_dump()
    except (ValueError, TypeError):
        return None


def create_calculator_server(executions):
    @tool(
        "calculate",
        "Calculate an arithmetic result from the operation and two finite operands. Preserve division-by-zero errors.",
        CalculatorInput.model_json_schema(),
        annotations=ToolAnnotations(readOnlyHint=True, destructiveHint=False),
    )
    async def calculator(args: dict[str, Any]) -> dict[str, Any]:
        value = CalculatorInput.model_validate(args)
        outcome = calculate(value).model_dump()
        executions.append(
            {
                "id": str(uuid.uuid4()),
                "input": value.model_dump(),
                "outcome": outcome,
                "processId": os.getpid(),
                "executedAt": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {
            "content": [{"type": "text", "text": json.dumps(outcome, allow_nan=False)}],
            "is_error": not outcome["ok"],
        }

    return create_sdk_mcp_server(name="calculator", version="1.0.0", tools=[calculator])
