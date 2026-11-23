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
    'Fresh local fixture per experiment · Original classroom note, revision 0\nSelected mode · ' +
    byId('mode').value +
    '\nHost deletion confirmation · ' +
    byId('confirm-delete').checked;
}
function displayReport(report) {
  lastReport = report;
  byId('handler-result').textContent = report.executions.length;
  byId('native-result-value').textContent = report.finalState.revision;
  byId('final-result').textContent = report.checks.stateBehaviorVerified ? 'Verified' : 'Review';
  byId('execution-count').textContent = report.toolResults.filter(
    (result) => result.isError,
  ).length;
  byId('handler').textContent = report.protocolTools
    .map(
      (tool) =>
        tool.name +
        '\n' +
        Object.entries(tool.annotations)
          .map(([name, value]) => name + ' · ' + value)
          .join('\n'),
    )
    .join('\n\n');
  byId('native-result').textContent = report.executions
    .map(
      (item, index) =>
        'Call ' +
        (index + 1) +
        ' · ' +
        item.outcome.operation +
        '\nNote · ' +
        JSON.stringify(item.outcome.note) +
        '\nRevision · ' +
        item.outcome.revision +
        ' · changed ' +
        item.outcome.changed +
        '\nBefore SHA-256 · ' +
        item.beforeSha256.slice(0, 16) +
        '…\nAfter SHA-256 · ' +
        item.afterSha256.slice(0, 16) +
        '…',
    )
    .join('\n\n');
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  const status = report.nativeServerStatus.find((server) => server.name === 'notes');
  byId('provenance').textContent = [
    'Host process ID · ' + report.hostProcessId,
    'Actual handler process IDs · ' + report.executions.map((item) => item.processId).join(', '),
    'Native connection · ' + status?.status,
    'Native server provenance · ' + JSON.stringify(report.hookResults[0]?.mcpServer ?? null),
    ...(status?.tools ?? []).map((tool) => tool.name + ' → ' + JSON.stringify(tool.annotations)),
  ].join('\n');
  byId('evidence').textContent = report.calls
    .filter((call) => call.name.startsWith('mcp__notes__'))
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      initialState: report.initialState,
      finalState: report.finalState,
      executions: report.executions,
      toolResults: report.toolResults,
      hookResults: report.hookResults,
      actualProtocolTools: report.protocolTools,
      actualNativeStatus: report.nativeServerStatus,
    },
    null,
    2,
  );
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (report.output?.ok === false
      ? report.output.errorCode +
        ' · The actual handler preserved the classroom note because host deletion confirmation was absent.'
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.output?.ok
      ? 'State behavior verified'
      : 'Handler guard observed'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.output?.ok ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual MCP annotation metadata, native SDK calls, state fingerprints and handler confirmation enforcement.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      initialState: report.initialState,
      finalState: report.finalState,
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
  for (const id of ['mode', 'value', 'confirm-delete', 'inspect', 'failure', 'repair'])
    byId(id).disabled = true;
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
    byId(id).textContent = 'Awaiting actual annotation and file-state evidence.';
  byId('status').textContent = 'Running actual note tools';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running actual SDK note tools in a fresh classroom workspace and comparing their state transitions.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: byId('mode').value,
        value: byId('value').value,
        confirmDelete: byId('confirm-delete').checked,
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
    for (const id of ['mode', 'value', 'confirm-delete', 'inspect', 'failure', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved annotation report unavailable.');
  const report = await response.json();
  byId('mode').value = report.requestedInput.mode;
  byId('value').value = report.requestedInput.value;
  byId('confirm-delete').checked = report.requestedInput.confirmDelete;
  showSelected();
  displayReport(report);
  return report;
}
for (const id of ['mode', 'value', 'confirm-delete']) byId(id).oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'delete';
  byId('confirm-delete').checked = false;
  showSelected();
};
byId('repair').onclick = () => {
  byId('mode').value = 'delete';
  byId('confirm-delete').checked = true;
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Annotation settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run the actual repeated update, inspect unchanged second-call state and reproduce the handler deletion guard.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
