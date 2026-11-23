import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from agent import run_agent

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


async def main():
    prompt = " ".join(sys.argv[1:]) or "Reply with READY."
    try:
        print(json.dumps(await run_agent(prompt), indent=2))
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
