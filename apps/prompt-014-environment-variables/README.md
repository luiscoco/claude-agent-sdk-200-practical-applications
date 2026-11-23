# Prompt 14 · Subprocess environment variables

Launch the actual TypeScript and Python SDK runtimes and inspect selected variables at their subprocess spawn boundary. Compare TypeScript's replacement behavior with an explicit parent-preserving map and Python's merge behavior.

## Setup

Use Node.js 22 or later and Python 3.10 or later. Run `npm ci`. Create a virtual environment with `python -m venv .venv`, activate it, and run `python -m pip install -r requirements-lock.txt`.

The application finds .venv/Scripts/python.exe on Windows or .venv/bin/python on other platforms. To use another configured interpreter, copy .env.example to .env and set PYTHON_EXECUTABLE to its absolute path. Run `npm start` and open http://127.0.0.1:43114.

For the command-line TypeScript experiment, run `npm run agent` to preserve the parent environment. To run the replacement case directly, use `npx tsx src/cli.ts --replace`. Run `python src/python_env.py` with the configured Python environment for the Python merge case.

## Experiments

1. Run the TypeScript replacement map. The explicit child override appears. The parent classroom marker and PATH are absent from the observed launch map in the recorded installation.
2. Choose Preserve parent variables and run. Spreading process.env before the override retains the parent marker and PATH.
3. Run Python merge. ClaudeAgentOptions.env contains the child override. The real SDK transport merges it with its parent environment, retaining the parent marker and PATH.
4. Reproduce the invalid-mode error, restore a valid selection, and download the observed report.

The two classroom markers are seeded with fixed public teaching values in each experiment process. TypeScript uses the public spawnClaudeCodeProcess callback and delegates the launch to the real native executable. startup() completes initialization, then the application closes the warm handle.

The Python experiment wraps the pinned SDK 0.2.180 transport's anyio.open_process launch for diagnostic observation and delegates to the original function. The wrapper uses an internal transport module path, which is version-specific. It records the classroom marker values and selected presence checks. ClaudeSDKClient connects to the actual native runtime and closes the connection after initialization.

These experiments perform native SDK initialization. They send no model prompt. The report stores two public classroom values and boolean PATH/API-key presence checks. The recorded API-key presence is false in this initialization-only lesson.

`npm test` verifies actual TypeScript SDK spawn behavior for replacement and parent preservation, plus invalid-mode validation. The browser recording separately checks the real Python merge result. `npm run typecheck` checks the installed TypeScript SDK declarations.

For practice, add another public classroom variable to the parent and predict which experiments retain it. Keep the environment map needed for your intended runtime and credential route when building a real application.

The cover and original main infographic follow the course branding. Author: Luis Coco Enríquez.

## References

- [TypeScript SDK env and startup() options](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Python SDK environment options](https://code.claude.com/docs/en/agent-sdk/python)
