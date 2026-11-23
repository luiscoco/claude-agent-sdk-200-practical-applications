import asyncio
import json
import os
from importlib.metadata import version
from unittest.mock import patch

import anyio
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient


async def inspect_python_environment():
    os.environ["CLAUDE_COURSE_PARENT"] = "PARENT_MARKER"
    os.environ["CLAUDE_COURSE_CUSTOM"] = "parent-default"
    observed = {}
    original_open_process = anyio.open_process

    async def observe_open_process(*args, **kwargs):
        environment = kwargs.get("env") or {}
        if "CLAUDE_AGENT_SDK_VERSION" in environment:
            observed.update({
                "parentMarker": environment.get("CLAUDE_COURSE_PARENT"),
                "customValue": environment.get("CLAUDE_COURSE_CUSTOM"),
                "pathPresent": any(name.lower() == "path" and bool(value) for name, value in environment.items()),
                "apiKeyPresent": bool(environment.get("ANTHROPIC_API_KEY")),
            })
        return await original_open_process(*args, **kwargs)

    options = ClaudeAgentOptions(
        env={"CLAUDE_COURSE_CUSTOM": "child-override"},
        tools=[], setting_sources=[], mcp_servers={},
    )
    with patch("claude_agent_sdk._internal.transport.subprocess_cli.anyio.open_process", observe_open_process):
        async with ClaudeSDKClient(options=options):
            initialized = True
    if not observed:
        raise RuntimeError("SPAWN_NOT_OBSERVED · The Python SDK subprocess launch was not observed.")
    return {
        "sdk": "Python", "sdkVersion": version("claude-agent-sdk"),
        "mode": "merge", "initialized": initialized,
        "initializationError": None, "observed": observed,
        "verified": observed["parentMarker"] == "PARENT_MARKER" and observed["customValue"] == "child-override",
        "modelPromptSent": False,
        "evidence": "Observed the pinned Python SDK transport's real anyio.open_process environment.",
    }


if __name__ == "__main__":
    print(json.dumps(asyncio.run(inspect_python_environment()), indent=2))
