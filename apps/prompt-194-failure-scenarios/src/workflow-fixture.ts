import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export const workflowScript = `export const meta = { name: "queue-review", description: "Two independent classroom checks and one synthesis", phases: ["Check", "Combine"] };
phase("Check");
const reports = await parallel([
  () => agent("Return only IDEMPOTENCY_REQUIRED for a safe queue."),
  () => agent("Return only RETRIES_BOUNDED for a safe queue.")
]);
phase("Combine");
const summary = await agent("Combine these two findings without changing them: " + JSON.stringify(reports));
log(summary);
`;
export async function writeWorkflow() {
  const directory = path.join(process.env.LAB_WORKSPACE!, '.claude/workflows'); await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'queue-review.js'); await writeFile(file, workflowScript); return file;
}
