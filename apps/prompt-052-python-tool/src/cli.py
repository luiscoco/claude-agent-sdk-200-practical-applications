import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from agent import run_with_timeout

if __name__ == "__main__":
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    value = {
        "operation": sys.argv[1] if len(sys.argv) > 1 else "add",
        "left": float(sys.argv[2]) if len(sys.argv) > 2 else 24,
        "right": float(sys.argv[3]) if len(sys.argv) > 3 else 18,
    }
    report = asyncio.run(run_with_timeout(value))
    print(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False))
    if not report["verified"]:
        raise SystemExit(1)
