const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/states.ts') {
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
    'Selected mode · ' +
    byId('mode').value +
    '\nState inspection · real native SDK status snapshots' +
    '\nInitialize probe · MCP client, 1,000 ms request deadline' +
    '\nTool probe · real SDK, 3,000 ms handler work, 1,000 or 5,000 ms call deadline' +
    '\nProtected resource · local classroom public-client and credential fixture';
}
function displayReport(report) {
  lastReport = report;
  const states = report.nativeServerStatus || [];
  const events = report.events || [];
  byId('handler-result').textContent = report.stage;
  byId('native-result-value').textContent = states.filter(
    (server) => server.status === 'connected',
  ).length;
  byId('final-result').textContent = report.timeoutMs ?? '—';
  byId('execution-count').textContent = events.filter(
    (event) => event.event === 'tool-started',
  ).length;
  byId('handler').textContent = JSON.stringify(
    {
      mode: report.mode,
      stage: report.stage,
      timeoutMs: report.timeoutMs ?? null,
      workMs: report.expectedInput?.workMs ?? null,
      elapsedMs: report.elapsedMs ?? null,
      userPromptsSent: report.userPromptsSent ?? 1,
      queryClosed: report.queryClosed ?? true,
    },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    states.map((server) => ({
      name: server.name,
      status: server.status,
      error: server.error || '',
      errorCode: server.error_code || '',
      serverInfo: server.serverInfo ?? null,
    })),
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(
    report.output ?? {
      statesObserved: report.statesObserved ?? [],
      initialized: report.connected ?? null,
      observedError: report.error || '',
    },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'Latest observed snapshot from the completed experiment. Native queries and owned server connections close after inspection.';
  byId('evidence').textContent = JSON.stringify(
    {
      snapshots: (report.snapshots || []).map((snapshot) => ({
        elapsedMs: snapshot.elapsedMs,
        states: snapshot.statuses.map((server) => ({ name: server.name, status: server.status })),
      })),
      processEvents: events,
      localEvents: report.localEvents || [],
      configuredEvents: report.configuredEvents || [],
      httpEvents: report.httpEvents || [],
    },
    null,
    2,
  );
  byId('tool-results').textContent = JSON.stringify(
    {
      calls: report.calls || [],
      decisions: report.decisions || [],
      nativeResults: report.results || [],
    },
    null,
    2,
  );
  byId('metadata').textContent = JSON.stringify(
    {
      checkedAt: report.checkedAt,
      nativeSessionId: report.sessionId || '',
      scenarioVerified: report.verified,
      privacyChecks: report.privacyChecks ?? null,
    },
    null,
    2,
  );
  byId('error').textContent = report.error || '';
  byId('error').classList.toggle('hidden', !report.error);
  byId('status').textContent = report.verified ? 'Scenario verified' : 'Review observations';
  byId('status').className = 'badge ' + (report.verified ? 'passed' : 'mismatch');
  byId('progress').textContent =
    report.mode === 'tool-timeout'
      ? 'The connected server admitted the real tool request. Its one-second call deadline expired.'
      : report.mode === 'connection-timeout'
        ? 'The actual initialize RPC exceeded its deadline before a tool handler ran.'
        : 'Compare the recorded native state, process events and verification checks.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'message', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  byId('status').textContent = 'Running actual experiment';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Waiting for real native connection or protocol request observations.';
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
    byId(id).textContent = 'Awaiting actual observations.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, message: byId('message').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'message', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved experiment unavailable.');
  const report = await response.json();
  byId('mode').value = report.requestedInput.mode;
  byId('message').value = report.requestedInput.message;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').oninput = showSelected;
byId('message').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'tool-timeout';
  showSelected();
};
byId('repair').onclick = () => {
  byId('mode').value = 'success';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
showSelected();
byId('inspect').disabled = false;
byId('status').textContent = 'Ready';
byId('progress').textContent =
  'Start with native state inspection, then compare the two timeout stages.';
