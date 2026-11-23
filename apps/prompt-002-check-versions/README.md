# Prompt 2 — SDK Version Inspector

Inspect the installed SDK and bundled runtime, then export a capability checklist tied to the actual installed TypeScript declarations.

## Run

Use Node.js 22 or newer. From this project directory, run `npm ci`, then `npm start`. Open http://127.0.0.1:43102.

The inspection executes the installed native Claude runtime with `--version`. It reads this project's SDK package metadata and `sdk.d.ts`. No API credential is required for these local checks.

Use **Inspect installed runtime** to observe the installed versions. **Try a version mismatch** fills the expected SDK version with `0.0.0`. Inspect again to see the failed comparison. **Use installed version** fills the observed SDK version so you can repair that comparison and run again.

Download the JSON report to retain the observed runtime output and declaration line numbers. The declaration checklist establishes which options appear in the installed Options type. Each feature needs its own runtime test to establish behavioral support in a specific provider and environment.

## Commands

```powershell
npm run inspect
npm run inspect -- 0.0.0
npm test
```

The mismatch command intentionally exits with code 1. A normal inspection passes when the bundled runtime matches the version declared by the installed SDK package. SDK and Claude Code have separate version numbers.

If the bundled executable is missing, reinstall with npm optional dependencies enabled. This inspector targets native packages on Windows, macOS and standard Linux installations. Musl Linux needs its matching native package and an adapted package selector.

## Exercise

Predict whether the installed SDK version and bundled Claude Code version should be identical. Run the inspector, locate `claudeCodeVersion` in the package metadata, and explain the relationship. Locate the `outputFormat` declaration and open its official documentation. Explain what additional evidence would be needed to claim a live structured-output test succeeded.

The original infographic is reused unchanged. The cover credits Author: Luis Coco Enríquez below the instructor photograph.

Sources include the [official TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript) and [official quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart), checked 2026-11-12. The installed package metadata and type declarations establish the versions shown in each report.
