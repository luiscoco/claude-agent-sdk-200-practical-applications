const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
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
function error(message) {
  byId('error').textContent = message;
  byId('error').classList.toggle('hidden', !message);
}
function showSelected() {
  byId('facts').textContent =
    'Native tools · Read\nPreapproval · allowedTools [Read]\nPath policy · ' +
    (byId('mode').value === 'no-hook'
      ? 'disabled for this owned baseline'
      : 'canonical target must stay inside allowed/') +
    '\nFixture topic · ' +
    byId('topic').value +
    '\nAll files and aliases belong to a fresh owned classroom workspace.';
}
function resetResult() {
  lastReport = undefined;
  for (const id of ['preapproved-value', 'hook-value', 'approval-value', 'read-value'])
    byId(id).textContent = '—';
  for (const id of ['request', 'admission', 'result', 'checks', 'evidence', 'metadata'])
    byId(id).textContent = 'Awaiting this actual native path experiment.';
  byId('download').classList.add('hidden');
  byId('download').removeAttribute('href');
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  showSelected();
  byId('preapproved-value').textContent = String(
    report.configuration.allowedTools.includes('Read'),
  );
  byId('hook-value').textContent = report.observedRequests.length;
  byId('approval-value').textContent = report.permissionRequests.length;
  byId('read-value').textContent = report.results.length
    ? report.results[0].isError
      ? 'Denied'
      : 'Completed'
    : 'No result';
  byId('request').textContent = JSON.stringify(
    {
      allowedTools: report.configuration.allowedTools,
      pathEnforcementEnabled: report.configuration.enforcementEnabled,
      requestedPath: report.requestedRelativePath,
    },
    null,
    2,
  );
  byId('admission').textContent = JSON.stringify(
    {
      canonicalTarget: report.canonicalRelativePath,
      decisions: report.observedRequests.map((request) => ({
        nativeToolUseId: request.id,
        allowed: request.allowed,
        reason: request.reason,
      })),
    },
    null,
    2,
  );
  byId('result').textContent = JSON.stringify(
    {
      output: report.output,
      nativeResults: report.results.map((result) => ({
        nativeToolUseId: result.id,
        isError: result.isError,
      })),
      fixturePreserved: report.fileEvidence.fixturePreserved,
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      nativeCalls: report.calls,
      pathHooks: report.observedRequests,
      hostCallbacks: report.permissionRequests,
      nativeResults: report.results,
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      runId: report.id,
      nativeSessionId: report.sessionId,
      checkedAt: report.checkedAt,
    },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Native path enforcement verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Inspect the actual preapproval, canonical target, hook decision and native Read result.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.error || (!report.verified ? 'Inspect the actual native checks.' : ''));
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed path report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = async () => {
  for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = true;
  error('');
  resetResult();
  byId('status').textContent = 'Running actual native Read';
  byId('status').className = 'badge';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'Native path check failed.');
    display(report);
  } catch (failure) {
    error(failure.message);
    byId('status').textContent = 'Request failed';
  } finally {
    for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = false;
  }
};
byId('mode').onchange = showSelected;
byId('topic').onchange = showSelected;
window.lesson = { showView, source, restore, report: () => lastReport };
for (const id of ['request', 'admission', 'result', 'checks', 'evidence', 'metadata'])
  byId(id).textContent = 'Awaiting the actual native path experiment.';
showSelected();
