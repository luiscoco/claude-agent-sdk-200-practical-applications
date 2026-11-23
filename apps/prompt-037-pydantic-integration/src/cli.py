import asyncio
import json
import sys
from pathlib import Path

from dotenv import load_dotenv
from workshop import run_with_timeout

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

if __name__ == "__main__":
    try:
        report = asyncio.run(
            run_with_timeout(
                sys.argv[1] if len(sys.argv) > 1 else "valid",
                sys.argv[2] if len(sys.argv) > 2 else "basics",
            )
        )
        print(json.dumps(report, indent=2, ensure_ascii=False))
        sys.exit(0 if report["verified"] else 1)
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
