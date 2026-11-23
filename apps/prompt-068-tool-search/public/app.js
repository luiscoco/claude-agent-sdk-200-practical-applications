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
  const settings = { 'low-threshold': 'auto:1', 'high-threshold': 'auto:100', disabled: 'false' };
  byId('facts').textContent =
    'Native ENABLE_TOOL_SEARCH · ' +
    settings[byId('mode').value] +
    '\nCatalog · 48 synthetic tools with deliberately verbose definitions' +
    '\nCore server · alwaysLoad true' +
    '\nRequested lesson · ' +
    byId('lesson-id').value +
    '\nContext measurement · native getContextUsage with full detail before and after the task';
}
async function comparisons(lessonId) {
  const response = await fetch('/api/comparisons?lessonId=' + encodeURIComponent(lessonId));
  if (!response.ok) throw new Error('Comparison measurements unavailable.');
  const rows = await response.json();
  byId('comparisons').replaceChildren();
  const order = ['low-threshold', 'high-threshold', 'disabled'];
  rows.sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode));
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.dataset.mode = row.mode;
    for (const value of [
      row.searchSetting,
      row.beforeMetrics?.usedMcpTokens ?? '—',
      row.beforeMetrics?.deferredMcpTokens ?? '—',
      row.measurements.taskElapsedMs ?? '—',
      row.measurements.nativeApiDurationMs ?? '—',
      row.id.slice(0, 8),
    ])
      tr.append(element('td', value));
    byId('comparisons').append(tr);
  }
}
async function displayReport(report) {
  lastReport = report;
  const searches = report.calls.filter((call) => call.name === 'ToolSearch');
  byId('handler-result').textContent = report.beforeMetrics?.usedMcpTokens ?? '—';
  byId('native-result-value').textContent = report.beforeMetrics?.deferredMcpTokens ?? '—';
  byId('final-result').textContent = searches.length;
  byId('execution-count').textContent = report.measurements.taskElapsedMs ?? '—';
  byId('handler').textContent = JSON.stringify(
    { setting: report.searchSetting, before: report.beforeMetrics, after: report.afterMetrics },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      coreAlwaysLoad: report.coreAlwaysLoad,
      searchCalls: searches.map((call) => ({ name: call.name, input: call.input })),
      handlers: [...report.coreEvents, ...report.catalogEvents].map((event) => event.name),
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'MCP token totals use the native context category id and kind. Full snapshots and raw per-tool flags are preserved in the report.';
  byId('evidence').textContent = JSON.stringify(
    {
      measurements: report.measurements,
      modelUsage: report.modelUsage,
      contextBefore: report.contextBefore.categories,
      contextAfter: report.contextAfter.categories,
    },
    null,
    2,
  );
  byId('tool-results').textContent = JSON.stringify(
    {
      calls: report.calls,
      decisions: report.decisions,
      results: report.results,
      coreEvents: report.coreEvents,
      catalogEvents: report.catalogEvents,
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      checkedAt: report.checkedAt,
      nativeSessionId: report.sessionId,
      resultStatus: report.resultStatus,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('error').textContent = report.error || '';
  byId('error').classList.toggle('hidden', !report.error);
  byId('status').textContent = report.verified
    ? 'Native measurements verified'
    : 'Review measurements';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Compare actual MCP schema categories, native search calls and measured task wall time for this classroom run.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  await comparisons(report.requestedInput.lessonId);
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'lesson-id', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  byId('status').textContent = 'Measuring actual native context';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Connecting the actual MCP servers, capturing full context snapshots and running the real model task.';
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
    byId(id).textContent = 'Awaiting actual context measurements.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, lessonId: Number(byId('lesson-id').value) }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    await displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'lesson-id', 'inspect', 'failure', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved measurement report unavailable.');
  const report = await response.json();
  byId('mode').value = report.requestedInput.mode;
  byId('lesson-id').value = report.requestedInput.lessonId;
  showSelected();
  await displayReport(report);
  return report;
}
byId('mode').oninput = showSelected;
byId('lesson-id').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'disabled';
  showSelected();
};
byId('repair').onclick = () => {
  byId('mode').value = 'low-threshold';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
showSelected();
byId('inspect').disabled = false;
byId('status').textContent = 'Ready';
byId('progress').textContent =
  'Measure the three settings for the same lesson to populate the comparison table.';
