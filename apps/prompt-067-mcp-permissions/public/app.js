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
  const rules = {
    individual: ['mcp__catalog__read_lesson'],
    'server-wide': ['mcp__catalog__*'],
    'bad-prefix': ['mcp__*'],
  };
  byId('facts').textContent =
    'Permission mode · default\nConfigured allowedTools · ' +
    JSON.stringify(rules[byId('mode').value]) +
    '\nAdvertised tools · mcp__catalog__read_lesson, mcp__catalog__list_lessons' +
    '\nRequested lesson · ' +
    byId('slug').value +
    '\nHost callback · deny requests that need approval after native rule evaluation' +
    '\nArgument hook · observes valid requests and leaves native permissions to decide';
}
function displayReport(report) {
  lastReport = report;
  byId('handler-result').textContent = report.allowedTools.length;
  byId('native-result-value').textContent = report.initialTools.filter((name) =>
    name.startsWith('mcp__catalog__'),
  ).length;
  byId('final-result').textContent = report.permissionRequests.length;
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(
    {
      permissionMode: report.permissionMode,
      allowedTools: report.allowedTools,
      requestedSlug: report.requestedInput.slug,
    },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      nativeStatus: report.nativeServerStatus.map((server) => ({
        name: server.name,
        status: server.status,
      })),
      callbackRequests: report.permissionRequests.map((request) => ({
        name: request.name,
        decision: request.decision,
      })),
      executedHandlers: report.executions.map((execution) => execution.name),
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'Actual native allow rules run before the host approval callback. The argument hook returns no permission override for each valid classroom request.';
  byId('evidence').textContent = JSON.stringify(
    {
      requests: report.observedRequests,
      permissionRequests: report.permissionRequests,
      executions: report.executions,
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
      nativeSessionId: report.sessionId,
      resultStatus: report.resultStatus,
      scenarioVerified: report.verified,
      privacyChecks: report.privacyChecks,
    },
    null,
    2,
  );
  byId('error').textContent = report.error || '';
  byId('error').classList.toggle('hidden', !report.error);
  byId('status').textContent = report.verified
    ? 'Native rule behavior verified'
    : 'Review observations';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent = report.permissionRequests.length
    ? 'Native rule evaluation sent ' +
      report.permissionRequests.length +
      ' unapproved request(s) to the denying host callback. Inspect actual handler admission.'
    : 'The catalog-scoped wildcard auto-approved both actual classroom calls before the host callback.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'slug', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  byId('status').textContent = 'Running native permission experiment';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Waiting for actual native rule evaluation, callback decisions and MCP handlers.';
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
    byId(id).textContent = 'Awaiting actual permission observations.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, slug: byId('slug').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'slug', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved permission report unavailable.');
  const report = await response.json();
  byId('mode').value = report.requestedInput.mode;
  byId('slug').value = report.requestedInput.slug;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').oninput = showSelected;
byId('slug').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'bad-prefix';
  showSelected();
};
byId('repair').onclick = () => {
  byId('mode').value = 'server-wide';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
showSelected();
byId('inspect').disabled = false;
byId('status').textContent = 'Ready';
byId('progress').textContent =
  'Compare the actual individual-tool and server-wide native allow rules.';
