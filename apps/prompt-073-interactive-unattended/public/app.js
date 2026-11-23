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

function configuration(mode) {
  return {
    tools: ['Read', 'Write'],
    allowedTools: mode === 'preapproved' ? ['Write'] : [],
    permissionMode: ['dont-ask', 'preapproved'].includes(mode) ? 'dontAsk' : 'default',
  };
}
function showSelected() {
  byId('facts').textContent =
    'Selected configuration · ' +
    JSON.stringify(configuration(byId('mode').value)) +
    '\nHost callback policy · ' +
    (byId('mode').value === 'default-allow' ? 'approve' : 'deny') +
    '\nClassroom topic · ' +
    byId('topic').value +
    '\nRead · synthetic note in a fresh owned workspace' +
    '\nWrite · exact copy to classroom-report.txt, one attempted operation when advertised' +
    '\nHost decision is selected before the run. Native dontAsk denies unapproved requests before this callback.';
}
function displayReport(report) {
  lastReport = report;
  byId('handler-result').textContent = report.permissionMode;
  byId('native-result-value').textContent = String(report.initialTools.includes('Write'));
  byId('final-result').textContent = report.permissionRequests.length;
  byId('execution-count').textContent = String(report.fileEvidence.exists);
  byId('handler').textContent = JSON.stringify(
    { permissionMode: report.permissionMode, ...report.configuration },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      advertisedFileTools: report.initialTools.filter((name) => ['Read', 'Write'].includes(name)),
      approvalCallback: report.permissionRequests.map((request) => ({
        name: request.name,
        decision: request.decision,
      })),
      nativeOutcomes: report.results.map((result) => ({
        name: result.name,
        isError: result.isError,
      })),
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(
    {
      output: report.output,
      actualFile: { exists: report.fileEvidence.exists, text: report.fileEvidence.actualText },
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'Native initialization supplies the actual advertised tool names. Each report compares the approval callback and real owned output file with the configured rule.';
  byId('evidence').textContent = JSON.stringify(
    {
      argumentHook: report.observedRequests,
      approvalCallback: report.permissionRequests,
      actualFile: report.fileEvidence,
    },
    null,
    2,
  );
  byId('tool-results').textContent = JSON.stringify(
    { calls: report.calls, nativeResults: report.results },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      checkedAt: report.checkedAt,
      scenarioVerified: report.verified,
      nativeSessionId: report.sessionId,
    },
    null,
    2,
  );
  byId('error').textContent = report.error || '';
  byId('error').classList.toggle('hidden', !report.error);
  byId('status').textContent = report.verified ? 'Permission mode verified' : 'Review diagnostics';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Inspect actual tool advertisement, native approval handling and the owned file result.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'topic', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  byId('status').textContent = 'Running the actual native permission configuration';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Waiting for native initialization, tool replies and the actual output file check.';
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
    byId(id).textContent = 'Awaiting actual native observations.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'topic', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved tool-permission report unavailable.');
  const report = await response.json();
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').oninput = showSelected;
byId('topic').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'dont-ask';
  showSelected();
};
byId('repair').onclick = () => {
  byId('mode').value = 'preapproved';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
showSelected();
byId('inspect').disabled = false;
byId('status').textContent = 'Ready';
byId('progress').textContent =
  'Choose a permission configuration and inspect actual availability, approval and file evidence.';
