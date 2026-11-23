import asyncio
import importlib.metadata
import os
import sys
from datetime import datetime, timezone

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    SystemMessage,
    TextBlock,
)

PROMPTS = [
    "Remember our course codename ORBIT and its starting lesson budget of 120. Reply with exactly STORED",
    "What is our course codename? Reply with only the codename.",
    "Add 30 to our starting lesson budget. Reply with only the new integer budget.",
]


def validate_mode(mode):
    if mode not in ("conversation", "unconnected"):
        raise ValueError("INVALID_MODE · Select conversation or unconnected.")
    return mode


async def run_conversation(mode):
    validate_mode(mode)
    report = {
        "mode": mode,
        "pythonVersion": sys.version.split()[0],
        "sdkVersion": importlib.metadata.version("claude-agent-sdk"),
        "nativeVersion": "",
        "turns": [],
        "clientContextCompleted": False,
        "success": False,
        "exception": None,
        "verified": False,
    }
    options = ClaudeAgentOptions(
        model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6"),
        tools=[],
        mcp_servers={},
        setting_sources=[],
        max_turns=4,
        max_budget_usd=1,
        system_prompt="You are a concise course-planning tutor. Preserve facts supplied in this conversation and follow the requested response format.",
    )
    try:
        if mode == "unconnected":
            client = ClaudeSDKClient(options=options)
            await client.query(PROMPTS[0])
            raise RuntimeError("The unconnected-client experiment unexpectedly completed.")
        if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
            raise ValueError("MISSING_CREDENTIALS · Configure ANTHROPIC_API_KEY locally.")
        async with ClaudeSDKClient(options=options) as client:
            for prompt in PROMPTS:
                await client.query(prompt)
                received_types = []
                assistant_text = []
                final_result = None
                async for message in client.receive_response():
                    received_types.append(type(message).__name__)
                    if isinstance(message, SystemMessage) and message.subtype == "init":
                        report["nativeVersion"] = message.data.get("claude_code_version", "")
                    elif isinstance(message, AssistantMessage):
                        assistant_text.extend(block.text for block in message.content if isinstance(block, TextBlock))
                    elif isinstance(message, ResultMessage):
                        final_result = message
                if final_result is None:
                    raise RuntimeError("NO_RESULT · receive_response ended without a ResultMessage.")
                turn = {
                    "prompt": prompt,
                    "answer": final_result.result or "\n".join(assistant_text),
                    "sessionId": final_result.session_id,
                    "resultSubtype": final_result.subtype,
                    "isError": final_result.is_error,
                    "receivedTypes": received_types,
                }
                report["turns"].append(turn)
                if final_result.subtype != "success" or final_result.is_error:
                    raise RuntimeError("SDK_RESULT_ERROR · " + (final_result.result or " ".join(final_result.errors or [])))
        report["clientContextCompleted"] = True
        report["success"] = True
        report["verified"] = (
            [turn["answer"].strip() for turn in report["turns"]] == ["STORED", "ORBIT", "150"]
            and len({turn["sessionId"] for turn in report["turns"]}) == 1
            and all(turn["receivedTypes"][-1] == "ResultMessage" for turn in report["turns"])
        )
    except Exception as error:
        message = str(error)
        secret = os.environ.get("ANTHROPIC_API_KEY")
        if secret:
            message = message.replace(secret, "[REDACTED]")
        report["exception"] = {"type": type(error).__name__, "message": message}
        report["verified"] = mode == "unconnected" and type(error).__name__ == "CLIConnectionError"
    report["checkedAt"] = datetime.now(timezone.utc).isoformat()
    return report


async def run_with_timeout(mode):
    return await asyncio.wait_for(run_conversation(mode), timeout=120)
