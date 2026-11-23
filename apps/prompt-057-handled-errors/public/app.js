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
  byId('facts').textContent =
    'Registered tool · mcp__orders__read_order\nSelected local classroom scenario · ' +
    byId('scenario').value +
    '\nFailure fixtures generate an in-memory synthetic credential and internal cause for the handler test.';
}
function displayReport(report) {
  lastReport = report;
  const execution = report.executions[0];
  const native = report.toolResults.find((result) => result.parsedOutcome);
  const outcome = execution?.outcome;
  byId('handler-result').textContent = outcome ? (outcome.ok ? 'ready' : outcome.errorCode) : '—';
  byId('native-result-value').textContent = outcome?.retryable ?? '—';
  byId('final-result').textContent = outcome?.reference ? outcome.reference.slice(0, 8) + '…' : '—';
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(outcome ?? null, null, 2);
  byId('native-result').textContent = JSON.stringify(native?.parsedOutcome ?? null, null, 2);
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent = JSON.stringify(
    {
      hostProcessId: report.hostProcessId,
      handlerProcessId: execution?.processId ?? null,
      nativeIsError: native?.isError ?? null,
      nativeMcpServer: report.hookResults.find((result) => result.mcpServer)?.mcpServer ?? null,
    },
    null,
    2,
  );
  byId('privacy').textContent = JSON.stringify(report.privacyChecks, null, 2);
  byId('diagnostics').textContent = JSON.stringify(
    {
      actualCauseObserved: execution?.causeObserved ?? false,
      syntheticCauseFingerprint: execution?.causeFingerprint ?? null,
      actualPublicReference: outcome?.reference ?? null,
      observedContentChecksPassed: report.privacyVerified,
    },
    null,
    2,
  );
  byId('evidence').textContent = report.calls
    .filter((call) => call.name === report.toolName)
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      toolResults: report.toolResults,
      hookResults: report.hookResults,
      visibleAssistantText: report.assistantText,
    },
    null,
    2,
  );
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (outcome?.ok === false
      ? outcome.errorCode + ' · ' + outcome.message + ' ' + outcome.recovery
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? outcome?.ok
      ? 'Public result verified'
      : 'Handled error observed'
    : 'Review';
  byId('status').className = 'badge ' + (report.verified && outcome?.ok ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual public handler, native result and final output with scoped private-detail checks.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
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
async function run() {
  lastReport = undefined;
  for (const id of ['scenario', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
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
    'privacy',
    'diagnostics',
  ])
    byId(id).textContent = 'Awaiting actual handled-error evidence.';
  byId('status').textContent = 'Calling handled tool';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running the actual SDK tool callback, local service fixture and public error mapping.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: byId('scenario').value,
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
    for (const id of ['scenario', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved handled-error report unavailable.');
  const report = await response.json();
  byId('scenario').value = report.requestedInput.scenario;
  showSelected();
  displayReport(report);
  return report;
}
byId('scenario').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('scenario').value = 'unavailable';
  showSelected();
};
byId('repair').onclick = () => {
  byId('scenario').value = 'success';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Handled-error settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run an actual classroom order tool, inspect a handled service error and compare the public outcomes and private-detail checks.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
