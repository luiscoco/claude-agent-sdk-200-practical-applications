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
  const url =
    byId('mode').value === 'connected'
      ? 'https://code.claude.com/docs/mcp'
      : 'https://code.claude.com/docs/mcp-unavailable-classroom';
  byId('facts').textContent =
    'Transport · Streamable HTTP\nEndpoint · ' +
    url +
    '\nActual search query · ' +
    byId('query').value;
}
function displayReport(report) {
  lastReport = report;
  const status = report.nativeServerStatus.find((server) => server.name === 'docs');
  const connected = report.preflight.connected;
  byId('handler-result').textContent = connected ? (status?.status ?? 'connected') : 'failed';
  byId('native-result-value').textContent = report.preflight.tools.length;
  byId('final-result').textContent = report.toolResults[0]?.isError ?? '—';
  byId('execution-count').textContent = report.calls.filter(
    (call) => call.name === 'mcp__docs__search_claude_code_docs',
  ).length;
  byId('handler').textContent = JSON.stringify(
    {
      type: report.connection.type,
      url: report.connection.url,
      stage: report.stage,
      sdkStarted: report.sdkStarted,
    },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      preflightConnected: connected,
      remoteServer: report.preflight.serverInfo,
      nativeStatus: status?.status ?? null,
      searchTool:
        report.preflight.tools.find((tool) => tool.name === 'search_claude_code_docs')?.name ??
        null,
    },
    null,
    2,
  );
  byId('final-output').textContent = report.output
    ? '“' + report.output.sourceExcerpt + '”\n\nSource\n' + report.output.sourceUrl
    : 'Connection failed before SDK inference.';
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'Actual remote endpoint · ' +
    report.connection.url +
    '\nReturned content SHA-256 · ' +
    (report.toolResults[0]?.sha256 ?? '—');
  byId('evidence').textContent = report.calls
    .filter((call) => call.name.startsWith('mcp__docs__'))
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      preflight: report.preflight,
      nativeServerStatus: report.nativeServerStatus,
      nativeToolResults: report.toolResults,
      hookResults: report.hookResults,
    },
    null,
    2,
  );
  byId('error').textContent = (report.error || report.resultErrors.join('\n')).slice(0, 1000);
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? connected
      ? 'Remote search verified'
      : 'Connection failure observed'
    : 'Review';
  byId('status').className = 'badge ' + (report.verified && connected ? 'passed' : 'mismatch');
  byId('progress').textContent = connected
    ? 'Actual public remote discovery and SDK invocation preserved. The excerpt and source URL are matched against the actual returned documentation.'
    : 'Actual remote HTTP error preserved. Restore the valid endpoint to run the SDK search.';
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
  for (const id of ['mode', 'query', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
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
    byId(id).textContent = 'Awaiting actual remote HTTP evidence.';
  byId('status').textContent = 'Connecting remote MCP';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Checking actual remote HTTP discovery before starting the SDK search.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: byId('mode').value,
        query: byId('query').value,
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
    for (const id of ['mode', 'query', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved HTTP report unavailable.');
  const report = await response.json();
  byId('mode').value = report.requestedInput.mode;
  byId('query').value = report.requestedInput.query;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').oninput = showSelected;
byId('query').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'invalid-route';
  showSelected();
};
byId('repair').onclick = () => {
  byId('mode').value = 'connected';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Remote MCP settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Connect the public documentation endpoint, inspect a real HTTP failure and recover with a fresh SDK search.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
