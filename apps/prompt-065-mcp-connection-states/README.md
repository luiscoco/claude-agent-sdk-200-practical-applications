# Prompt 65 · MCP connection states and timeout diagnosis

Author: Luis Coco Enríquez

## Run the application

Use Node.js 22 or later. Install the pinned dependencies with `npm ci`, copy `.env.example` to `.env`, then set your own `ANTHROPIC_API_KEY` locally. Run `npm start` and open `http://127.0.0.1:43165`.

The state inspection and direct MCP initialize probe submit zero user task prompts. The two model-driven tool experiments require your API credential and incur normal provider usage. `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. `PORT` can change the local web port.

The project includes the original infographic and a lesson cover with the instructor credit below the photo. The UI provides the actual source files, native observations and downloadable reports.

## Experiments

- **Inspect native connection states** starts an actual delayed stdio MCP process, a protected HTTP fixture and a stdio command pointing to a missing script. A held input generator submits no user task while the host polls `query.mcpServerStatus()`. The report preserves real pending snapshots and the final connected, needs-auth and failed states.
- **Repair all three connections** supplies the protected resource's runtime bearer credential and corrects the local script path. The actual native status must report three connected servers.
- **Initialize deadline** uses the MCP protocol client directly. Its initialize request has a 1,000 ms deadline while server startup deliberately waits 4,000 ms. The actual protocol error and handler audit establish the observed failure stage. Process startup and teardown affect measured elapsed time.
- **Connected tool deadline** uses an actual Claude Agent SDK query with one exact permitted `mcp__worker__echo` call. The stdio server connects first. Its handler performs 3,000 ms of synthetic work while the per-server `timeout` is 1,000 ms. The report preserves the real native tool error and the observed handler start.
- **Tool deadline repair** raises that per-server deadline to 5,000 ms and compares the completed handler outcome with the native tool result and structured model output.

The native SDK's per-server tool-call timeout has a 1,000 ms minimum. The initialize experiment is implemented through the direct MCP client's request deadline. Inspect `src/states.ts` and `src/agent.ts` for the separate APIs and startup settings used by these experiments.

## Classroom fixtures and evidence

All messages, local services, credentials and process delays are classroom fixtures. The HTTP broker creates an ephemeral loopback resource and random bearer credential for each experiment. Its public-client registration fixture lets the installed native client report the real `needs-auth` state. The repaired experiment supplies the runtime credential directly. Interactive consent and token exchange are taught by Prompt 64.

The UI shows the latest observed snapshot from a completed experiment. The host closes native queries, transports and broker connections afterward. A timeout describes the observed client request deadline. Inspect the recorded process audit to establish what server-side work occurred during that run.

The tool permission hook admits one call with exact arguments. Any extra model attempts are denied and preserved with their native errors. The verifier compares admitted results with actual handler events. Downloaded reports retain session identifiers, timestamps, state snapshots, configured deadlines and observed results. Runtime report redaction checks the exact experiment credential and configured API key values.

Run artifacts are stored under `runs/` locally. The student archive excludes those runtime files, dependency folders, teacher recordings and credentials. Fresh server starts maintain a new in-memory download index.

## Checks and command-line use

Run `npm run typecheck` and `npm test`. The regression checks cover input validation, initialize timeout, connected call timeout followed by a healthy call, and protected HTTP admission.

Run `npm run agent -- states`, `npm run agent -- states-repaired`, `npm run agent -- connection-timeout`, `npm run agent -- tool-timeout`, or `npm run agent -- success "My synthetic message"` for JSON evidence. A failed verification returns a nonzero exit status.

For the exercise, run a different synthetic message with the five-second tool deadline. Compare its exact input, process events, native result and structured output. Repeat state inspection and explain each recorded state from its concrete configuration and error evidence.

## Reference

The lesson targets the pinned SDK versions in `package-lock.json`. Connection-state and startup behavior follows the installed native runtime. Consult the current official MCP integration documentation for other versions. [Claude Agent SDK MCP integration](https://code.claude.com/docs/en/agent-sdk/mcp)
