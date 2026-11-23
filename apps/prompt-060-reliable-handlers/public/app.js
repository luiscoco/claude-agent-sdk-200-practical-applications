const byId = (id) => document.getElementById(id);
let lastReport;
let scenarios;
let statusGeneration = 0;
let activeControlId = null;
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
  const setting = scenarios?.[byId('mode').value];
  byId('facts').textContent =
    'Local HTTP fixture · Synthetic classroom bookings\nScenario · ' +
    byId('mode').value +
    (setting
      ? '\nAPI processing · ' +
        setting.processingMs +
        ' ms · Reply delay · ' +
        setting.replyDelayMs +
        ' ms\nHandler deadline sequence · ' +
        setting.deadlines.join(' → ') +
        ' ms'
      : '');
}
function displayReport(report) {
  lastReport = report;
  byId('handler-result').textContent = report.backend.receipts.length;
  byId('native-result-value').textContent = report.backend.bookings.length;
  byId('final-result').textContent = report.executions.length;
  byId('execution-count').textContent = report.backend.receipts.filter(
    (receipt) => receipt.replayed,
  ).length;
  byId('handler').textContent = report.executions
    .map(
      (item) =>
        'Attempt ' +
        item.attempt +
        ' · deadline ' +
        item.deadlineMs +
        ' ms\nActual elapsed · ' +
        item.elapsedMs +
        ' ms\nClient outcome · ' +
        (item.outcome.ok ? item.outcome.bookingId : item.outcome.errorCode) +
        '\nReplayed · ' +
        item.outcome.replayed +
        '\nDeadline expired · ' +
        item.deadlineExpired +
        ' · host cancellation ' +
        item.hostCancellationObserved,
    )
    .join('\n\n');
  byId('native-result').textContent = report.backend.receipts
    .map(
      (receipt, index) =>
        'HTTP request ' +
        (index + 1) +
        ' · replay ' +
        receipt.replayed +
        '\nOperation phase · ' +
        report.backend.operations.find((operation) => operation.id === receipt.operationId)?.phase +
        '\nBooking · ' +
        receipt.bookingId +
        '\nReply sent · ' +
        receipt.responseSent +
        '\nClient closed before reply · ' +
        receipt.clientClosedBeforeReply,
    )
    .join('\n\n');
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(
    { ...report.checks, ...report.scenarioChecks },
    null,
    2,
  );
  byId('provenance').textContent = [
    'Host process ID · ' + report.hostProcessId,
    'Actual handler process IDs · ' + report.executions.map((item) => item.processId).join(', '),
    'Native server provenance · ' + JSON.stringify(report.hookResults[0]?.mcpServer ?? null),
    'Host cancellation requested · ' + report.cancelRequested,
  ].join('\n');
  byId('evidence').textContent = report.calls
    .filter((call) => call.name === report.toolName)
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      executions: report.executions,
      nativeToolResults: report.toolResults,
      hookResults: report.hookResults,
      actualHttpBackend: report.backend,
    },
    null,
    2,
  );
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (report.output?.ok === false
      ? report.output.errorCode +
        ' · Inspect actual API receipts and committed effects for this request.'
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.output?.ok
      ? report.output.replayed
        ? 'Idempotent retry verified'
        : 'API result verified'
      : report.output?.errorCode === 'CANCELLED'
        ? 'Host cancellation observed'
        : 'Deadline observed'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.output?.ok ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual HTTP attempts, API commits, replay receipts, native tool outcomes and final structured output.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      actualRequestKey: report.expectedToolInput.requestKey,
      operationControlId: report.controlId,
      sdkResultStatus: report.resultStatus,
      sdkConversationSucceeded: report.success,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function pollStatus(generation) {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) return;
    const status = await response.json();
    if (generation !== statusGeneration) return;
    activeControlId = status.controlId;
    byId('cancel').disabled = !status.canCancel;
    if (status.busy)
      byId('progress').textContent =
        'Actual experiment phase · ' +
        status.phase +
        (status.canCancel
          ? ' · The local API accepted this request. Host cancellation is available.'
          : '');
  } catch {
    /* The main request reports connection failures. */
  }
}
byId('cancel').onclick = async () => {
  const controlId = activeControlId;
  byId('cancel').disabled = true;
  try {
    const response = await fetch('/api/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ controlId }),
    });
    const result = await response.json();
    byId('progress').textContent = response.ok
      ? 'Host cancellation requested for the admitted API call.'
      : result.error;
  } catch (error) {
    byId('progress').textContent = error.message;
  }
};
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'label', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  for (const id of ['handler-result', 'native-result-value', 'final-result', 'execution-count'])
    byId(id).textContent = '—';
  for (const id of [
    'handler',
    'native-result',
    'final-output',
    'checks',
    'provenance',
    'evidence',
    'tool-results',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting actual HTTP reliability evidence.';
  byId('status').textContent = 'Running actual API tool';
  byId('status').className = 'badge';
  byId('progress').textContent = 'Starting the actual SDK and isolated classroom HTTP API.';
  const generation = ++statusGeneration;
  const polling = setInterval(() => pollStatus(generation), 250);
  void pollStatus(generation);
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: byId('mode').value,
        label: byId('label').value,
      }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    clearInterval(polling);
    statusGeneration++;
    activeControlId = null;
    byId('cancel').disabled = true;
    for (const id of ['mode', 'label', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved reliability report unavailable.');
  const report = await response.json();
  byId('mode').value = report.requestedInput.mode;
  byId('label').value = report.requestedInput.label;
  showSelected();
  displayReport(report);
  return report;
}
for (const id of ['mode', 'label']) byId(id).oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'timeout';
  showSelected();
};
byId('repair').onclick = () => {
  byId('mode').value = 'retry-after-timeout';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Reliability settings unavailable.');
  scenarios = (await response.json()).scenarios;
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run the same-key retry experiment. In cancellation mode, the cancel button activates after the local API accepts its request.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
