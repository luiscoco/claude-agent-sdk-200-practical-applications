# Prompt 5 — Runtime Doctor

Run `npm ci`, then `npm start` with Node.js 22 or newer. Open http://127.0.0.1:43105. The application checks the selected language version against its installed SDK requirement, identifies the operating system and architecture, locates the native runtime and executes its version command.

To inspect a Python SDK installation, copy `.env.example` to `.env`, set `PYTHON_EXECUTABLE` to that environment's Python executable, then restart the application. Install the Python SDK in that environment first. The Python inspection uses the selected interpreter's public distribution metadata to locate its bundled binary.

Use the missing executable example to select an actually absent fixture path. The diagnosis identifies the missing file and supplies a remedy. Select the installed runtime and inspect again to observe recovery.

Run `npm run diagnose`, `npm run diagnose -- --missing`, or `npm run diagnose -- --python` for the CLI. An attention result exits with code 1. Run `npm test` to verify minimum-version comparisons, input validation and the real installed/missing binary paths.

The automatic minimum check handles the simple `>=major.minor.patch` or `>=major.minor` constraints used by these installed releases. Other constraint forms produce a review result. A successful local native launch establishes that the selected binary starts on the observed machine. Consult the package metadata and current official documentation when choosing another environment.

Exercise: inspect both installed language environments, compare their SDK and bundled runtime versions, select the missing executable example and explain which check fails first. Export the diagnosis and identify the exact evidence supporting the remedy.

The production workspace shares its pinned TypeScript SDK installation with the earlier labs. The downloadable project installs its own dependencies with `npm ci`. The original infographic is reused and the cover displays Author: Luis Coco Enríquez below the instructor photograph.

Sources include the [official quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart), [TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript), and installed package metadata. The quickstart describes bundled native binaries and installations that require a separate executable.
