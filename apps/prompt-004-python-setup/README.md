# Prompt 4 — Python setup

Create an isolated Python project, install the Claude Agent SDK, and run the entry point using the interpreter from that environment.

## Windows PowerShell

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-lock.txt
Copy-Item .env.example .env
# Edit .env locally and configure your own API key.
.venv/Scripts/python.exe src/cli.py
.venv/Scripts/python.exe src/server.py
```

Open http://127.0.0.1:43104 for the application. Calling the environment interpreter directly works without activating the environment. On macOS and Linux use `python3 -m venv .venv` and `.venv/bin/python` for the subsequent commands.

The recording uses Python 3.12.15 and claude-agent-sdk 0.2.180. `requirements.txt` pins the direct dependencies. `requirements-lock.txt` records the dependency versions installed for the demonstration, with the Windows-only dependency marked for that platform.

`src/agent.py` validates the task and credentials, creates `ClaudeAgentOptions`, then consumes `query` with `async for`. The function accepts a result after a successful `ResultMessage`. The CLI entry point uses `asyncio.run` to execute the asynchronous function.

The browser displays the actual interpreter, Python version, SDK version and whether it is running in a virtual environment. Its live runs use the same `run_agent` function as the CLI. Each live model run consumes API credit.

Run `.venv/Scripts/python.exe -m unittest discover -s tests` to check that invalid tasks and missing credentials stop before a query. The video and accompanying evidence include a real authenticated SDK execution as well.

Exercise: run the CLI using the environment interpreter, then explain the difference between `sys.prefix` and `sys.base_prefix`. Change the task and inspect the observed messages. Try an empty task and explain why the SDK does not start for that request.

The original main infographic is reused. The cover credits Author: Luis Coco Enríquez below the instructor photo. Consult the [official Python reference](https://code.claude.com/docs/en/agent-sdk/python) and [official quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart) for the SDK interfaces and installation commands.
