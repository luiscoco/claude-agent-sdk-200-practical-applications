import asyncio
import importlib.metadata
import json
import os
import sys
import threading
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
from pydantic import ValidationError
from agent import run_with_timeout
from calculator import CalculatorInput

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
RUN_LOCK = threading.Lock()
REPORTS = {}
SOURCES = [
    "src/agent.py",
    "src/calculator.py",
    "src/server.py",
    "src/cli.py",
    "requirements.txt",
]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "public"), **kwargs)

    def end_headers(self):
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
        )
        super().end_headers()

    def send_json(self, status, payload, download=False):
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if download:
            self.send_header(
                "Content-Disposition",
                'attachment; filename="python-calculator-observed-report.json"',
            )
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/config":
            self.send_json(
                200,
                {
                    "defaultInput": {"operation": "add", "left": 24, "right": 18},
                    "operations": ["add", "subtract", "multiply", "divide"],
                    "pythonVersion": sys.version.split()[0],
                    "sdkVersion": importlib.metadata.version("claude-agent-sdk"),
                },
            )
            return
        if parsed.path == "/api/source":
            file = parse_qs(parsed.query).get("file", [SOURCES[0]])[0]
            if file not in SOURCES:
                self.send_json(404, {"error": "Unknown source file."})
                return
            self.send_json(
                200,
                {
                    "file": file,
                    "files": SOURCES,
                    "content": (ROOT / file).read_text(encoding="utf-8"),
                },
            )
            return
        if parsed.path.startswith("/api/report/"):
            file = REPORTS.get(parsed.path.removeprefix("/api/report/"))
            if file is None:
                self.send_json(404, {"error": "Unknown report."})
                return
            self.send_json(
                200, json.loads(file.read_text(encoding="utf-8")), download=True
            )
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/run":
            self.send_json(404, {"error": "Unknown endpoint."})
            return
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + self.headers.get("Host", ""):
            self.send_json(403, {"error": "Unexpected request origin."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 4096:
                raise ValueError("Supply a small JSON request.")
            payload = json.loads(self.rfile.read(length))
        except (ValueError, TypeError) as error:
            self.send_json(400, {"error": str(error)})
            return
        try:
            CalculatorInput.model_validate(payload)
        except ValidationError as error:
            self.send_json(
                422,
                {
                    "error": "INVALID_INPUT · Supply an operation and two finite classroom operands. "
                    + str(error)
                },
            )
            return
        if not RUN_LOCK.acquire(blocking=False):
            self.send_json(
                409,
                {
                    "error": "Wait for the current Python calculator experiment to finish."
                },
            )
            return
        try:
            result = asyncio.run(run_with_timeout(payload))
            identifier = str(uuid.uuid4())
            directory = ROOT / "runs" / identifier
            directory.mkdir(parents=True)
            file = directory / "report.json"
            result = {"id": identifier, **result}
            file.write_text(
                json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False),
                encoding="utf-8",
            )
            REPORTS[identifier] = file
            self.send_json(200, result)
        except Exception as error:
            message = (
                "CALCULATOR_TIMEOUT · The Python tool query exceeded 90 seconds."
                if isinstance(error, TimeoutError)
                else str(error)
            )
            secret = os.environ.get("ANTHROPIC_API_KEY")
            if secret:
                message = message.replace(secret, "[REDACTED]")
            self.send_json(422, {"error": message[:1000]})
        finally:
            RUN_LOCK.release()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "43152"))
    print(f"Prompt 52 lab http://127.0.0.1:{port}", flush=True)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()
