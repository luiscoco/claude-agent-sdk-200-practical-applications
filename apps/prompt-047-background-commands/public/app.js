const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/background.ts') {
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

let currentId;
let pollTimer;
let requestBusy = false;
function showSelected() {
  byId('facts').textContent =
    byId('mode').value === 'cancel'
      ? 'Fixed 20-second task · native Bash run_in_background true · SDK stopTask(taskId)'
      : 'Fixed 6-second task · native Bash run_in_background true · observe native completion';
}
function controls() {
  const active = lastReport && !lastReport.closed;
  byId('mode').disabled = requestBusy || active;
  byId('inspect').disabled = requestBusy || active;
  byId('repair').disabled = requestBusy || active;
  byId('cancel').disabled = requestBusy || lastReport?.stage !== 'running';
}
function displayReport(report) {
  if (lastReport?.id === report.id && lastReport.closed && !report.closed) return;
  lastReport = report;
  byId('task-stage').textContent = report.stage;
  byId('process-state').textContent =
    report.captured.processAlive === true
      ? 'Running'
      : report.captured.processAlive === false
        ? 'Exited'
        : 'Awaiting receipt';
  byId('exit-code').textContent = report.captured.exitCode ?? 'No status receipt';
  byId('verified').textContent = report.verified
    ? 'Verified'
    : report.closed
      ? 'Review'
      : 'Observing';
  byId('lifecycle').textContent = JSON.stringify(
    {
      actualBackgroundTaskId: report.taskId || null,
      nativeTaskStatus: report.terminalEvent?.status ?? null,
      stopTaskRequested: report.stopRequested,
      stopTaskAcknowledged: report.stopAcknowledged,
      actualProcessAlive: report.captured.processAlive,
      finalShellExitStatus: report.captured.exitCode,
      sessionClosed: report.closed,
    },
    null,
    2,
  );
  byId('stdout').textContent = report.captured.stdout ?? 'Waiting for stdout capture.';
  byId('stderr').textContent = report.captured.stderr ?? 'Waiting for stderr capture.';
  byId('command').textContent = report.command;
  byId('events').textContent = report.events
    .filter((event) =>
      [
        'native-Bash-response',
        'task_started',
        'task_notification',
        'stopTask-request',
        'stopTask-acknowledged',
        'stopTask-error',
      ].includes(event.type),
    )
    .map((event) => {
      const detail = event.detail;
      return (
        `${event.sequence}. ${event.type}` +
        (event.type === 'task_notification'
          ? ` · ${detail.status} · ${detail.task_id}`
          : event.type === 'native-Bash-response'
            ? ` · ${detail.backgroundTaskId ?? 'No task ID'}`
            : event.type === 'task_started'
              ? ` · ${detail.task_id}`
              : detail?.taskId
                ? ` · ${detail.taskId}`
                : '')
      );
    })
    .join('\n');
  byId('full-events').textContent = JSON.stringify(report.events, null, 2);
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      processReceiptMatchesRun: report.captured.receiptMatches,
      actualProcessReceipt: report.captured.receipt,
      actualShellStatusReceipt: report.captured.statusText,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? report.stage === 'stopped'
      ? 'Cancellation verified'
      : 'Completion verified'
    : report.stage;
  byId('status').className = 'badge ' + (report.verified ? 'passed' : '');
  byId('progress').textContent = report.closed
    ? 'Preserved native lifecycle events, actual command capture and observed process state.'
    : 'Following native SDK task events and actual process output.';
  if (report.error) {
    byId('error').textContent = report.error;
    byId('error').classList.remove('hidden');
  }
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  controls();
}
function showError(error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
async function poll() {
  if (!currentId) return;
  const requestedId = currentId;
  try {
    const response = await fetch('/api/state/' + encodeURIComponent(currentId));
    const report = await response.json();
    if (currentId !== requestedId) return;
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
    if (!report.closed) pollTimer = setTimeout(poll, 250);
  } catch (error) {
    showError(error);
  }
}
async function start() {
  clearTimeout(pollTimer);
  requestBusy = true;
  currentId = undefined;
  lastReport = undefined;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  for (const id of ['task-stage', 'process-state', 'exit-code', 'verified'])
    byId(id).textContent = '—';
  for (const id of [
    'stdout',
    'stderr',
    'lifecycle',
    'events',
    'full-events',
    'command',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting actual background evidence.';
  byId('status').textContent = 'Starting';
  controls();
  try {
    const response = await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    currentId = report.id;
    displayReport(report);
    pollTimer = setTimeout(poll, 250);
  } catch (error) {
    showError(error);
  } finally {
    requestBusy = false;
    controls();
  }
}
async function cancel() {
  if (!currentId) return;
  requestBusy = true;
  controls();
  try {
    const response = await fetch('/api/cancel/' + encodeURIComponent(currentId), {
      method: 'POST',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    displayReport(data);
  } catch (error) {
    showError(error);
  } finally {
    requestBusy = false;
    controls();
  }
}
async function restore(id) {
  clearTimeout(pollTimer);
  const response = await fetch('/api/state/' + encodeURIComponent(id));
  const report = await response.json();
  if (!response.ok) throw new Error(report.error);
  currentId = id;
  byId('mode').value = report.mode;
  showSelected();
  byId('error').classList.add('hidden');
  displayReport(report);
  if (!report.closed) pollTimer = setTimeout(poll, 250);
  return report;
}
byId('mode').onchange = showSelected;
byId('inspect').onclick = start;
byId('cancel').onclick = cancel;
byId('repair').onclick = () => {
  byId('mode').value = 'complete';
  showSelected();
  return start();
};
window.lesson = { showView, source, restore, cancel, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Background task settings unavailable.');
  showSelected();
  byId('status').textContent = 'Ready';
  byId('progress').textContent = 'Start a bounded background task and inspect its real lifecycle.';
  controls();
} catch (error) {
  showError(error);
}
