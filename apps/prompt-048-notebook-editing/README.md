# Prompt 48 · Notebook editing

Use actual native Read and NotebookEdit tools to replace one code cell in a small Jupyter notebook. Independently inspect the resulting file, verify cells and metadata, and execute its actual pricing-cell source through Python before and after the edit.

## Run locally

Install Node.js 22 or later and Python 3.10 or later. Run `npm ci`. Copy `.env.example` to `.env` and configure your own Anthropic API key locally. Set `PYTHON_PATH` to the Python executable or its absolute path. On Windows, verify that this selects an installed Python interpreter. Run `npm start` and open `http://127.0.0.1:43148`.

The Python verifier uses the standard library. The classroom app executes the trusted supplied pricing cell in an isolated Python subprocess with a five-second execution timeout. It performs the original execution before starting a paid SDK run. The resulting cell executes after its source and preservation checks pass. The notebook's saved outputs and execution count retain their supplied values.

Select the existing `pricing-cell` and run the edit. The original incorrect calculation adds a discount, producing 5000 euro cents. The specified corrected calculation subtracts it, producing 4000 euro cents. A second actual function call changes from 3250 to 2750 cents. These values come from execution of the saved cell source.

## Notebook and native evidence

Each run creates a fresh working notebook and an original snapshot. Native Read inspects the notebook, and native NotebookEdit receives its absolute path, exact cell ID, `edit_mode: "replace"` and the specified replacement source. Scoped permission checks allow that operation on the classroom working notebook.

The verifier checks the exact requested source, other cells, selected-cell metadata, cell order, notebook metadata and format version. Jupyter permits source fields represented as a string or list of strings. The helper joins list entries when comparing source. The native tool rewrites JSON formatting and can store the changed source as a single string. The actual file bytes and SHA-256 hash are preserved for download verification.

The deliberately missing cell ID produces a genuine native validation error. That tool result is captured from the SDK user message. The missing-cell validation can run before lifecycle hooks, so the app retains the actual tool result for this case. Independent checks confirm the original notebook bytes and original calculation results. Restore the existing cell ID and run a new successful edit.

Download the actual `checkout.ipynb` and observed JSON report. The report preserves original and resulting notebooks, native calls and results, native edit response, preservation checks and actual Python execution evidence. Reports remain local in `runs/`. Restarting clears the in-memory download index.

## Verify and explore

Run `npm run typecheck` and `npm test`. Use `npm run agent -- edit` or `npm run agent -- missing` for actual CLI experiments. Real SDK calls require network access and incur inference charges.

Compare the corrected cell with the original, inspect the preserved introductory and author cells, and reproduce the missing-cell error. Restore the real cell ID, verify the two Python results, and download the repaired notebook. Open the file in your preferred Jupyter-compatible editor for further classroom exploration.

## References

- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- [Jupyter notebook format and source representation](https://nbformat.readthedocs.io/en/latest/format_description.html)
- Installed official SDK 0.3.322 declarations for `NotebookEditInput` and `NotebookEditOutput`. The bundled native Claude Code version is 2.1.322.

The original infographic and author-photo cover are included with provenance. Disclose AI-assisted course creation and synthetic narration in the course description. The instructor reviews accuracy and final editorial presentation before release.
