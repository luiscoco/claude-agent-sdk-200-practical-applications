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

from agent import run_agent

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
RUN_LOCK = threading.Lock()
REPORTS = {}
SOURCES = {"src/agent.py", "src/cli.py", "src/server.py", "requirements.txt"}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "public"), **kwargs)

    def end_headers(self):
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/config":
            self.send_json(200, {
                "apiConfigured": bool(os.environ.get("ANTHROPIC_API_KEY", "").strip()),
                "model": os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6"),
                "python": sys.version.split()[0],
                "interpreter": sys.executable,
                "isolated": sys.prefix != sys.base_prefix,
                "sdk": importlib.metadata.version("claude-agent-sdk"),
            })
            return
        if parsed.path == "/api/source":
            file = parse_qs(parsed.query).get("file", ["src/agent.py"])[0]
            if file not in SOURCES:
                self.send_json(404, {"error": "Unknown source file."})
                return
            self.send_json(200, {"file": file, "files": sorted(SOURCES), "content": (ROOT / file).read_text(encoding="utf-8")})
            return
        if parsed.path.startswith("/api/report/"):
            report = REPORTS.get(parsed.path.removeprefix("/api/report/"))
            if report is None:
                self.send_json(404, {"error": "Unknown report."})
                return
            self.send_json(200, json.loads(report.read_text(encoding="utf-8")))
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
        length = int(self.headers.get("Content-Length", "0"))
        if length < 1 or length > 4096:
            self.send_json(400, {"error": "Supply a small JSON task."})
            return
        try:
            payload = json.loads(self.rfile.read(length))
            prompt = payload.get("prompt")
            if not isinstance(prompt, str) or len(prompt) > 1000:
                raise ValueError("Supply a prompt of at most 1000 characters.")
        except (ValueError, AttributeError):
            self.send_json(400, {"error": "Supply a JSON object with a prompt of at most 1000 characters."})
            return
        if not RUN_LOCK.acquire(blocking=False):
            self.send_json(409, {"error": "Wait for the current run to finish."})
            return
        try:
            result = asyncio.run(run_agent(prompt))
            identifier = str(uuid.uuid4())
            directory = ROOT / "runs" / identifier
            directory.mkdir(parents=True)
            report = directory / "report.json"
            result = {"id": identifier, "prompt": prompt, **result}
            report.write_text(json.dumps(result, indent=2), encoding="utf-8")
            REPORTS[identifier] = report
            self.send_json(200, result)
        except Exception as error:
            message = str(error)
            secret = os.environ.get("ANTHROPIC_API_KEY")
            if secret:
                message = message.replace(secret, "[REDACTED]")
            self.send_json(422, {"error": message[:800]})
        finally:
            RUN_LOCK.release()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "43104"))
    print(f"Prompt 4 lab http://127.0.0.1:{port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
