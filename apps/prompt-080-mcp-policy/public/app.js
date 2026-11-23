const byId = (id) => document.getElementById(id);
let lastReport,
  configurations = {};
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
    'Selected configuration · ' +
    JSON.stringify(configurations[byId('mode').value]) +
    '\nNative MCP tool · mcp__classroom__save_note' +
    '\nHost response · ' +
    (byId('mode').value === 'ask-allow'
      ? 'allow this exact request'
      : 'deny any request reaching the host callback') +
    '\nFixture · one owned synthetic ' +
    byId('topic').value +
    ' classroom note' +
    '\nThe response is preselected for this experiment. All callbacks, handler admissions and file outcomes are actual observations.';
}
function display(report) {
  lastReport = report;
  byId('mode').value = report.requestedInput.mode;
  byId('topic').value = report.requestedInput.topic;
  showSelected();
  byId('mode-value').textContent = report.nativePermissionMode;
  byId('callback-value').textContent = report.permissionRequests.length;
  byId('handler-value').textContent = report.executions.length;
  byId('file-value').textContent = String(report.fileEvidence.exists);
  byId('configuration').textContent = JSON.stringify(
    {
      permissionMode: report.configuration.permissionMode,
      allowedTools: report.configuration.allowedTools,
      mcpToolPolicies: report.configuration.tools,
      allowDangerouslySkipPermissions: report.configuration.allowDangerouslySkipPermissions,
    },
    null,
    2,
  );
  byId('permission').textContent = JSON.stringify(
    {
      toolAdvertised: report.advertised,
      callbacks: report.permissionRequests.map((item) => ({
        nativeToolUseId: item.id,
        decision: item.decision,
      })),
      nativeResults: report.results.map((item) => ({
        nativeToolUseId: item.id,
        isError: item.isError,
      })),
    },
    null,
    2,
  );
  byId('file').textContent = JSON.stringify(
    { output: report.output, actualFile: report.fileEvidence },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('evidence').textContent = JSON.stringify(
    {
      nativeRequests: report.calls,
      argumentHooks: report.observedRequests,
      nativeResults: report.results,
      actualExecutions: report.executions,
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      runId: report.id,
      nativeSessionId: report.sessionId,
      checkedAt: report.checkedAt,
      runtime: 'SDK 0.3.322 · native 2.1.322',
    },
    null,
    2,
  );
  byId('status').textContent = report.verified
    ? 'Native MCP policy verified'
    : 'Verification failed';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Inspect the actual native mode, callback, handler execution and file outcome.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  error(report.error || (!report.verified ? 'Inspect the actual native checks.' : ''));
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Observed report unavailable.');
  const report = await response.json();
  display(report);
  return report;
}
byId('inspect').onclick = async () => {
  for (const id of ['inspect', 'mode', 'topic']) byId(id).disabled = true;
  error('');
  byId('status').textContent = 'Running actual native MCP call';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Waiting for the actual model, permission policy and owned handler.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || 'MCP policy experiment failed.');
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
for (const id of ['configuration', 'permission', 'file', 'checks', 'evidence', 'metadata'])
  byId(id).textContent = 'Awaiting an actual native MCP policy experiment.';
try {
  const response = await fetch('/api/config');
  const config = await response.json();
  configurations = config.configurations;
  byId('mode').value = config.defaultInput.mode;
  byId('topic').value = config.defaultInput.topic;
  showSelected();
  byId('status').textContent = 'Ready';
  byId('progress').textContent = 'Choose a policy and run its actual MCP operation.';
} catch (failure) {
  error(failure.message);
}
byId('inspect').disabled = false;
