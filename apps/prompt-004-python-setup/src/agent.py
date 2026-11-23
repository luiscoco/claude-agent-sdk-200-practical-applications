import os

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    SystemMessage,
    TextBlock,
    query,
)


async def run_agent(prompt: str) -> dict:
    if not prompt.strip():
        raise ValueError("Enter a task before starting a model run.")
    if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
        raise ValueError("Set ANTHROPIC_API_KEY in your local environment before running the agent.")

    options = ClaudeAgentOptions(
        model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6"),
        tools=[],
        mcp_servers={},
        setting_sources=[],
        max_turns=2,
        max_budget_usd=0.10,
    )
    events = []
    result = None
    async for message in query(prompt=prompt, options=options):
        if isinstance(message, SystemMessage) and message.subtype == "init":
            model = message.data.get("model", "unknown")
            tool_count = len(message.data.get("tools", []))
            events.append({"type": "system", "detail": f"Initialized {model}. Tools exposed: {tool_count}."})
        elif isinstance(message, AssistantMessage):
            text = "\n".join(block.text for block in message.content if isinstance(block, TextBlock))
            if text:
                events.append({"type": "assistant", "detail": text})
        elif isinstance(message, ResultMessage):
            if message.subtype != "success" or message.is_error:
                raise RuntimeError(f"The SDK returned {message.subtype}.")
            events.append({"type": "result", "detail": "Successful SDK result received."})
            result = {
                "answer": message.result,
                "sessionId": message.session_id,
                "estimatedCostUsd": message.total_cost_usd,
                "events": events,
            }
    if result is None:
        raise RuntimeError("The SDK stream ended without a successful result.")
    return result
