const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/agent.ts') {
  const response = await fetch('/api/source?file=' + encodeURIComponent(file));
  if (!response.ok) throw new Error('Source unavailable.');
  const data = await response.json();
  byId('source-title').textContent = data.file;
  byId('files').replaceChildren();
  byId('source').replaceChildren();
  for (const name of data.files) {
    const button = element('button', name);
    button.className = 'secondary';
    button.onclick = () => source(name);
    byId('files').append(button);
  }
  data.content.split('\n').forEach((line, index) => {
    const row = element('span', line || ' ');
    row.className = 'code-line';
    row.dataset.line = index + 1;
    byId('source').append(row);
  });
}
async function showView(name) {
  document
    .querySelectorAll('.view')
    .forEach((view) => view.classList.toggle('hidden', view.id !== name + '-view'));
  document
    .querySelectorAll('[data-view]')
    .forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'source') await source();
}
document
  .querySelectorAll('[data-view]')
  .forEach((button) => (button.onclick = () => showView(button.dataset.view)));

function showSelected() {
  const mode = byId('mode').value;
  byId('facts').textContent =
    mode === 'timeout'
      ? 'Fixed slow check · six-second task · native Bash foreground timeout 1000 ms'
      : mode === 'failure'
        ? 'Fixed failing check · deliberate process exit 7 · captured stdout and stderr'
        : 'Fixed successful check · process exit 0 · captured stdout and stderr';
}
function displayReport(report) {
  lastReport = report;
  byId('exit-code').textContent = report.captured.exitCode ?? 'Unavailable';
  byId('timeout-status').textContent = report.foregroundTimedOut
    ? report.timeout + ' ms reached'
    : 'Within limit';
  byId('sdk-status').textContent = report.sdkSuccess ? 'Success' : 'Error';
  byId('verified').textContent = report.verified ? 'Verified' : 'Review';
  byId('stdout').textContent = report.captured.stdout ?? 'Command capture unavailable.';
  byId('stderr').textContent = report.captured.stderr ?? 'Command capture unavailable.';
  byId('command').textContent = report.command;
  byId('lifecycle').textContent = JSON.stringify(
    {
      requestedForegroundTimeoutMs: report.timeout,
      actualTimedOutAfterMs: report.nativeResponse?.timedOutAfterMs ?? null,
      actualBackgroundTaskId: report.nativeResponse?.backgroundTaskId ?? null,
      actualCompletionStatus: report.completion?.status ?? null,
      actualCompletionSummary: report.completion?.summary ?? null,
      finalShellExitStatus: report.captured.exitCode,
    },
    null,
    2,
  );
  byId('evidence').textContent = report.calls
    .map(
      (call, index) =>
        `${index + 1}. ${call.name} · timeout ${call.input.timeout} ms · background ${Boolean(call.input.run_in_background)}`,
    )
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    { hookResults: report.hookResults, toolResults: report.toolResults },
    null,
    2,
  );
  byId('task-events').textContent = JSON.stringify(report.taskEvents, null, 2);
  const nativeFailure = report.hookResults.find((result) => result.event === 'PostToolUseFailure');
  byId('error').textContent = report.error || nativeFailure?.error || '';
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.mode === 'failure'
      ? 'Exit 7 captured'
      : report.mode === 'timeout'
        ? 'Timeout and completion verified'
        : 'Verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.mode !== 'failure' ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual native Bash evidence, captured command streams, shell exit status and background completion events.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      processReceiptMatchesRun: report.captured.receiptMatches,
      shellStatusReceipt: report.captured.statusText,
      nativeToolReportedFailure: report.nativeFailure,
      sdkConversationSucceeded: report.sdkSuccess,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  for (const id of ['exit-code', 'timeout-status', 'sdk-status', 'verified'])
    byId(id).textContent = '—';
  for (const id of [
    'stdout',
    'stderr',
    'lifecycle',
    'command',
    'evidence',
    'tool-results',
    'task-events',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting actual command evidence.';
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Executing the approved classroom command through native Bash and capturing its actual outcome.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'success';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Command settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run a fixed classroom command and inspect its actual native Bash evidence.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
