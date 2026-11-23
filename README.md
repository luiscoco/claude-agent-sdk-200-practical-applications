# Claude Agent SDK — 200 Practical Applications

**Learn to build agents by running, inspecting and changing real application code.**

A public companion repository by **Luis Coco Enríquez**, instructor of [**Claude Agent SDK: Build Autonomous AI Agents** on Udemy](https://www.udemy.com/course/claude-agent-sdk-build-autonomous-ai-agents/).

**[Explore the 200 applications](docs/PROMPT_INDEX.md)** · **[Start with a local experiment](apps/prompt-101-context-usage/README.md)** · **[View the course curriculum and preview lessons](https://www.udemy.com/course/claude-agent-sdk-build-autonomous-ai-agents/)**

## Turn the examples into skills

Move from configuring your first agent to building tools, controlling permissions, restoring sessions, streaming responses and evaluating results. Each prompt has its own application folder, source code and setup guide. Most examples use TypeScript/Node.js; Python examples and a language-portability exercise are included too.

Use this repository to practice alongside the course or explore the code before enrolling. The Udemy course provides the guided explanations and video lessons; this repository provides the application examples you can inspect and modify. **You do not need to purchase the course to browse or run these files.** Model calls and cloud services may have their own charges.

## Run your first application

Install **Git and Node.js 24+**, then run:

```bash
git clone https://github.com/luiscoco/claude-agent-sdk-200-practical-applications.git
cd claude-agent-sdk-200-practical-applications/apps/prompt-101-context-usage
npm ci
npm start
```

Open **http://127.0.0.1:43201**. Prompt 101 compares actual local SDK context reports without requesting assistant inference. **No API key or paid model call is required for this starting example.** Try the profiles, inspect the source and download the observed report.

Each application is an independent project. Install dependencies inside the chosen application, and use its README for its URL and commands. There is no need to install 200 projects at once. These applications require their backend; opening an HTML file directly or enabling GitHub Pages does not run the SDK.

Want a smaller download? Use a sparse checkout to fetch one example and the guides:

```bash
git clone --filter=blob:none --sparse https://github.com/luiscoco/claude-agent-sdk-200-practical-applications.git
cd claude-agent-sdk-200-practical-applications
git sparse-checkout set apps/prompt-101-context-usage docs scripts
```

Then enter `apps/prompt-101-context-usage` and run `npm ci` and `npm start`.

## Choose what you want to build

| Your goal | Start here |
| --- | --- |
| Understand the SDK, CLI and API choices | [001 — Claude ecosystem](apps/prompt-001-claude-ecosystem/README.md) |
| Set up a Python project | [004 — Python setup](apps/prompt-004-python-setup/README.md) |
| Inspect context without model charges | [101 — Context usage](apps/prompt-101-context-usage/README.md) |
| Build retrieval with evidence references | [181 — Retrieval-augmented generation](apps/prompt-181-retrieval-augmented-generation/README.md) |
| Expose an agent through an API | [183 — REST service](apps/prompt-183-rest-service/README.md) |
| Add streaming, cancellation and approvals | [185 — Chat interface](apps/prompt-185-chat-interface/README.md) |
| Query an authorized read-only database | [186 — Database assistant](apps/prompt-186-database-assistant/README.md) |
| Fix a failing test inside approved files | [188 — Coding assistant](apps/prompt-188-coding-assistant/README.md) |
| Schedule and retry durable jobs | [190 — Durable jobs](apps/prompt-190-durable-jobs/README.md) |
| Compare TypeScript and Python contracts | [197 — Language portability](apps/prompt-197-language-portability/README.md) |

**[Browse every prompt →](docs/PROMPT_INDEX.md)**

## A practical study routine

1. Open the application README and identify the behavior it demonstrates.
2. Run its local checks and inspect the observed events, files or tool results.
3. Change one input, policy or owned fixture and explain the difference.
4. Configure your own credentials locally when the exercise needs real inference.
5. Compare the live result with the local contract, then apply the pattern to your own project.

Most Node applications use `npm run typecheck` and `npm test`; individual READMEs describe exceptions. Python examples include their own requirements and interpreter instructions. Prompt 187 additionally uses Chrome; prompt 197 needs Python 3.12+.

## Local checks and real model calls

**200 application folders are included. This is not a claim that every live or deployment scenario has been verified.** Local SDK operations, deterministic fixtures and paid model inference are distinguished in the examples and reports.

Prompts **171–200 and 7–9** passed TypeScript, scoped local integration, and desktop/mobile browser checks in the 23 November 2026 build. Their real-model verification remains pending replacement credentials. Other lessons retain their individual setup and verification notes. Container execution, cloud IAM/model access, supported-host sandbox containment and clean-machine portability require the target checks described in those lessons. Prompt 200 reports capability gaps rather than certifying exhaustive SDK coverage.

For examples that use it, copy `.env.example` to a local `.env` and configure your own credentials. Follow the chosen lesson's live-run command; many later examples use `npm run verify:live`. Actual model calls consume account credits, and multi-query examples make multiple calls. A ChatGPT or Claude chat subscription does not provide this repository with API credentials.

See [setup and troubleshooting](docs/SETUP.md) and [verification scope](docs/VERIFICATION.md).

## What is included

- Application source, tests, dependency lockfiles and required classroom fixtures.
- Browser interfaces and small lesson graphics where supplied.
- Per-application READMEs and a searchable JSON prompt catalog.
- Environment templates containing placeholders only.

Videos, audio recordings, production projects, archives, dependencies, generated run state and credentials are excluded. Individual publishable files are limited to 5 MiB. UI images are retained so the examples display correctly; this is a code-and-graphics collection rather than the course video download.

## Continue with the guided course

If you want explanations alongside the code, [**view Claude Agent SDK: Build Autonomous AI Agents on Udemy**](https://www.udemy.com/course/claude-agent-sdk-build-autonomous-ai-agents/). Review the curriculum and available previews to decide whether its teaching style matches how you learn.

Already enrolled? Keep this repository open beside the relevant topic, run the application, and make one deliberate change before moving on. If the collection helps your learning, consider starring it so you can return to it.

This is an independent educational project. It is not affiliated with or endorsed by Anthropic. Third-party SDKs and tools retain their respective licenses.
