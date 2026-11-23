# Prompt 6 — Anthropic authentication

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env`, and configure your Anthropic API credential locally. Then run `npm start` and open http://127.0.0.1:43106.

The application supports a process-environment source, explicit project dotenv loading, and a blank configuration example. **Check configuration** inspects the selected source. **Run authenticated query** verifies service access through a real SDK result.

Dotenv is loaded explicitly with `config({path, processEnv, override:false})`. The function copies the supplied environment before loading file defaults. An existing process credential takes precedence over the file. The public summary reports credential presence, origin, loaded variable names and the selected model. The SDK subprocess receives the resolved private environment.

In the production recording, the credential is supplied through the process environment. The project `.env` contains the model and a blank credential field. Explicit dotenv loading is demonstrated while the process credential retains precedence. Students can configure their own key in their local `.env` when using the downloaded project.

The blank example loads `fixtures/blank.env` into an empty environment. Its missing key produces `MISSING_CREDENTIALS` before a query starts. Select the process environment or configure the project dotenv file, then retry to observe recovery.

Commands include `npm run auth -- --check`, `npm run auth -- --environment`, `npm run auth -- --blank`, `npm test`, and `npm run typecheck`. A live query consumes API credit. The unit tests cover public summaries, environment preservation, explicit dotenv loading, unsupported modes and the missing-credential branch.

Exercise: compare process-environment and dotenv sources. Predict which credential origin appears when both sources are configured. Check the configuration, run the agent, inspect the downloaded report, then reproduce the missing-key branch with the blank example.

The original infographic is reused, and Author: Luis Coco Enríquez appears below the instructor photo on every cover. See the [official quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart) and [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript) for authentication setup and subprocess environment options.
