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
from workshop import Workshop, prepare_task, run_with_timeout, validate_mode

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
RUN_LOCK = threading.Lock()
REPORTS = {}
SOURCES = ["src/workshop.py", "src/cli.py", "src/server.py", "requirements.txt"]


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
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if download:
            self.send_header(
                "Content-Disposition",
                'attachment; filename="pydantic-validation-report.json"',
            )
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/config":
            self.send_json(
                200,
                {
                    "pythonVersion": sys.version.split()[0],
                    "sdkVersion": importlib.metadata.version("claude-agent-sdk"),
                    "pydanticVersion": importlib.metadata.version("pydantic"),
                    "tasks": [prepare_task("basics"), prepare_task("streaming")],
                    "schema": Workshop.model_json_schema(),
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
            report = REPORTS.get(parsed.path.removeprefix("/api/report/"))
            if report is None:
                self.send_json(404, {"error": "Unknown report."})
                return
            self.send_json(
                200, json.loads(report.read_text(encoding="utf-8")), download=True
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
            mode = validate_mode(payload.get("mode"))
            prepare_task(payload.get("task"))
        except (ValueError, AttributeError, TypeError) as error:
            self.send_json(400, {"error": str(error)})
            return
        if not RUN_LOCK.acquire(blocking=False):
            self.send_json(
                409, {"error": "Wait for the current Pydantic experiment to finish."}
            )
            return
        try:
            result = asyncio.run(run_with_timeout(mode, payload.get("task")))
            identifier = str(uuid.uuid4())
            directory = ROOT / "runs" / identifier
            directory.mkdir(parents=True)
            report = directory / "report.json"
            result = {"id": identifier, **result}
            report.write_text(
                json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            REPORTS[identifier] = report
            self.send_json(200, result)
        except Exception as error:
            message = (
                "PYDANTIC_TIMEOUT · The Python structured query exceeded 90 seconds."
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
    port = int(os.environ.get("PORT", "43137"))
    print(f"Prompt 37 lab http://127.0.0.1:{port}", flush=True)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    try:
        server.serve_forever()
    finally:
        server.server_close()
