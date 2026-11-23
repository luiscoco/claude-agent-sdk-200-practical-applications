Build: `docker build -t claude-worker-171 .`

Run: `docker run --rm -p 127.0.0.1:43271:43271 --tmpfs /app/runs:uid=1000,gid=1000,mode=0700 claude-worker-171`

Open http://127.0.0.1:43271 and run the local experiment. Use `--env-file` pointing to a locally protected replacement credential file only for live runs. Credentials must never be build arguments or image layers. Host tests do not establish image portability, architecture compatibility or production isolation. This teaching UI is bound to loopback through the port mapping.
