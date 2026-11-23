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
    'Controlled classroom mode · ' +
    byId('mode').value +
    '\nRecovered page size · ' +
    byId('page-size').value +
    '\nOversized case · 400 synthetic rows, explicit 2,000-token native output budget' +
    '\nDisconnect and unavailable cases · actual native reconnectMcpServer' +
    '\nTool result evidence · native replies, owned process audit and persisted payload hash';
}
function displayReport(report) {
  lastReport = report;
  const boots = report.events.filter((event) => event.event === 'boot');
  byId('handler-result').textContent = report.diagnosis?.code || 'Review';
  byId('native-result-value').textContent = String(report.reconnectPerformed);
  byId('final-result').textContent = report.fileProof?.actualRows ?? '—';
  byId('execution-count').textContent = report.output?.count ?? '—';
  byId('handler').textContent = JSON.stringify(
    report.diagnosis
      ? {
          code: report.diagnosis.code,
          message: report.diagnosis.message,
          recoveryAction: report.diagnosis.recoveryAction,
          configuredOutputTokenBudget: report.configuredOutputTokenBudget,
          ...(report.requestedInput.mode === 'unavailable'
            ? { modelPromptsAtDiagnosis: report.diagnosis.modelPromptsAtDiagnosis }
            : {}),
        }
      : { error: report.error },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      initialNativeState: report.before.map((server) => ({
        name: server.name,
        status: server.status,
        tools: (server.tools || []).map((tool) => tool.name),
      })),
      afterRecoveryControl: report.afterReconnect.map((server) => ({
        name: server.name,
        status: server.status,
        tools: (server.tools || []).map((tool) => tool.name),
      })),
      actualServerBootPids: boots.map((event) => event.processId),
      modelPromptsSubmitted: report.promptsSubmitted,
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'The diagnostic uses actual tool replies and process events. The completed bounded tool call verifies recovery after the control action.';
  byId('evidence').textContent = JSON.stringify(
    {
      events: report.events,
      persistedOutputProof: report.fileProof,
      phaseResults: report.phaseResults.map((result) => ({
        phase: result.phase,
        status: result.status,
        sessionId: result.sessionId,
        output: result.output,
        error: result.error,
      })),
    },
    null,
    2,
  );
  byId('tool-results').textContent = JSON.stringify(
    { calls: report.calls, decisions: report.decisions, nativeResults: report.results },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      checkedAt: report.checkedAt,
      scenarioVerified: report.verified,
      nativeSessionIds: report.phaseResults.map((result) => result.sessionId),
    },
    null,
    2,
  );
  byId('error').textContent = report.error || '';
  byId('error').classList.toggle('hidden', !report.error);
  byId('status').textContent = report.verified ? 'Native recovery verified' : 'Review diagnostics';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Compare the actual diagnostic, recovery action and completed bounded result from this live SDK session.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'page-size', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  byId('status').textContent = 'Diagnosing and recovering actual MCP state';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Waiting for actual native discovery, failure evidence and the repaired tool call.';
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
    byId(id).textContent = 'Awaiting actual MCP observations.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, pageSize: Number(byId('page-size').value) }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'page-size', 'inspect', 'failure', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved MCP recovery report unavailable.');
  const report = await response.json();
  byId('mode').value = report.requestedInput.mode;
  byId('page-size').value = report.requestedInput.pageSize;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').oninput = showSelected;
byId('page-size').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'oversized';
  showSelected();
};
byId('repair').onclick = () => {
  byId('page-size').value = '5';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
showSelected();
byId('inspect').disabled = false;
byId('status').textContent = 'Ready';
byId('progress').textContent =
  'Choose a controlled classroom failure and verify its actual native recovery.';
