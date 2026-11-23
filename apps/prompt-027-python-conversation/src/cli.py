import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from conversation import run_with_timeout

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

if __name__ == "__main__":
    report = asyncio.run(run_with_timeout(sys.argv[1] if len(sys.argv) > 1 else "conversation"))
    print(json.dumps(report, indent=2, ensure_ascii=False))
    raise SystemExit(0 if report["success"] else 1)
