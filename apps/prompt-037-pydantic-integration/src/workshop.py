import asyncio
import importlib.metadata
import os
import sys
from datetime import datetime, timezone

from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, SystemMessage, query
from pydantic import BaseModel, ConfigDict, Field, ValidationError


class Workshop(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    title: str = Field(min_length=1)
    duration_minutes: int = Field(ge=1, le=120)
    prerequisites: list[str] = Field(min_length=1)
    published: bool


def prepare_task(name):
    if not isinstance(name, str) or name not in ("basics", "streaming"):
        raise ValueError("INVALID_TASK · Select a classroom workshop.")
    expected = (
        {
            "title": "Agent SDK Basics",
            "duration_minutes": 25,
            "prerequisites": ["Python", "async/await"],
            "published": False,
        }
        if name == "basics"
        else {
            "title": "Streaming Lab",
            "duration_minutes": 40,
            "prerequisites": ["SDK query", "Async generators"],
            "published": True,
        }
    )
    source = (
        f"Workshop title: {expected['title']}\n"
        f"Duration: {expected['duration_minutes']} minutes\n"
        f"Prerequisites, in order: {', '.join(expected['prerequisites'])}\n"
        f"Published: {'yes' if expected['published'] else 'no'}"
    )
    return {"name": name, "expected": expected, "sourceText": source}


def validate_mode(mode):
    if not isinstance(mode, str) or mode not in ("valid", "corrupt-boundary"):
        raise ValueError("INVALID_MODE · Select valid or corrupt-boundary.")
    return mode


def consume_workshop(workshop: Workshop):
    return {
        "title": workshop.title,
        "totalMinutesWithBreak": workshop.duration_minutes + 5,
        "prerequisiteText": " → ".join(workshop.prerequisites),
        "publicationLabel": "Published" if workshop.published else "Draft",
    }


def corrupt_duration(value):
    if isinstance(value, dict) and "duration_minutes" in value:
        return {**value, "duration_minutes": str(value["duration_minutes"])}
    return value


async def run_pydantic(mode, task_name):
    validate_mode(mode)
    task = prepare_task(task_name)
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise ValueError("MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.")
    schema = Workshop.model_json_schema()
    raw_output = None
    answer = ""
    error = ""
    success = False
    session_id = ""
    native_version = ""
    options = ClaudeAgentOptions(
        model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6"),
        tools=[],
        mcp_servers={},
        setting_sources=[],
        max_turns=4,
        max_budget_usd=0.5,
        system_prompt="Extract the supplied workshop facts into the requested structured result.",
        output_format={"type": "json_schema", "schema": schema},
    )
    try:
        async for message in query(
            prompt="Preserve the exact title and prerequisite order.\n"
            + task["sourceText"],
            options=options,
        ):
            if isinstance(message, SystemMessage) and message.subtype == "init":
                native_version = message.data.get("claude_code_version", "")
            if not isinstance(message, ResultMessage):
                continue
            success = message.subtype == "success" and not message.is_error
            raw_output = message.structured_output if success else None
            answer = message.result or ""
            session_id = message.session_id
            if not success:
                error = answer or message.subtype
    except Exception as failure:
        error = str(failure)
    candidate = (
        corrupt_duration(raw_output) if mode == "corrupt-boundary" else raw_output
    )
    parsed = None
    issues = []
    try:
        parsed = Workshop.model_validate(candidate)
    except ValidationError as failure:
        issues = failure.errors(include_url=False)
    typed_output = (
        consume_workshop(parsed)
        if success and not error and parsed is not None
        else None
    )
    raw_facts_matched = raw_output == task["expected"]
    scenario_matched = (
        parsed is None
        and typed_output is None
        and any(issue["loc"] == ("duration_minutes",) for issue in issues)
        if mode == "corrupt-boundary"
        else parsed is not None
        and parsed.model_dump() == task["expected"]
        and typed_output is not None
        and typed_output["totalMinutesWithBreak"]
        == task["expected"]["duration_minutes"] + 5
    )
    return {
        "mode": mode,
        "task": task,
        "jsonSchema": schema,
        "rawOutput": raw_output,
        "candidate": candidate,
        "parsedData": parsed.model_dump() if parsed is not None else None,
        "validationPassed": parsed is not None,
        "issues": issues,
        "typedOutput": typed_output,
        "typedConsumerCalled": typed_output is not None,
        "rawFactsMatched": raw_facts_matched,
        "success": success,
        "answer": answer,
        "error": error,
        "sessionId": session_id,
        "runtime": {
            "python": sys.version.split()[0],
            "sdk": importlib.metadata.version("claude-agent-sdk"),
            "pydantic": importlib.metadata.version("pydantic"),
            "native": native_version,
        },
        "verified": success and not error and raw_facts_matched and scenario_matched,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }


async def run_with_timeout(mode, task_name):
    return await asyncio.wait_for(run_pydantic(mode, task_name), timeout=90)
