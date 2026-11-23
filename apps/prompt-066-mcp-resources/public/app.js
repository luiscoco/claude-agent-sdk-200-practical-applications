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
    'MCP server · library over stdio\nRequested URI · ' +
    byId('uri').value +
    '\nDiscover · ListMcpResourcesTool → resources/list' +
    '\nRead context · ReadMcpResourceTool → resources/read' +
    '\nCompute from arguments · mcp__library__total_minutes → tools/call' +
    '\nContent source · synthetic classroom JSON fixture';
}
function displayReport(report) {
  lastReport = report;
  const readEvent = report.events.find((event) => event.method === 'resources/read');
  const resource = readEvent?.result?.contents[0];
  const calculations = report.events.filter((event) => event.method === 'tools/call');
  byId('handler-result').textContent = resource ? 'Read' : 'Missing';
  byId('native-result-value').textContent = report.decisions.filter(
    (decision) =>
      decision.allowed && ['ListMcpResourcesTool', 'ReadMcpResourceTool'].includes(decision.name),
  ).length;
  byId('final-result').textContent = report.output?.totalMinutes ?? '—';
  byId('execution-count').textContent = calculations.length;
  byId('handler').textContent = JSON.stringify(
    resource
      ? {
          uri: resource.uri,
          mimeType: resource.mimeType,
          body: JSON.parse(resource.text),
        }
      : { uri: report.requestedInput.uri, error: readEvent?.error || report.error },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      nativeStates: report.nativeServerStatus.map((server) => ({
        name: server.name,
        status: server.status,
      })),
      helpers: report.calls
        .filter((call) => ['ListMcpResourcesTool', 'ReadMcpResourceTool'].includes(call.name))
        .map((call) => ({ name: call.name, input: call.input })),
      calculation: calculations[0]?.input ?? null,
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent =
    'Resource content comes from its URI. The calculation tool receives explicit segment arguments. Both operations preserve their actual MCP server audit.';
  byId('evidence').textContent = JSON.stringify(report.events, null, 2);
  byId('tool-results').textContent = JSON.stringify(
    { calls: report.calls, decisions: report.decisions, nativeResults: report.results },
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
  byId('error').textContent = report.error || readEvent?.error || '';
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? resource
      ? 'Resource and tool verified'
      : 'Missing resource observed'
    : 'Review observations';
  byId('status').className = 'badge ' + (report.verified && resource ? 'passed' : 'mismatch');
  byId('progress').textContent = resource
    ? 'Compare the returned resource context, actual protocol operations and computed tool result.'
    : 'The requested resource read failed. Restore a listed URI to run the actual read and calculation.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['uri', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download']) byId(id).classList.add('hidden');
  byId('status').textContent = 'Discovering and reading actual resource';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Waiting for the real SDK resource helpers and callable calculation tool.';
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
    byId(id).textContent = 'Awaiting actual MCP results.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri: byId('uri').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['uri', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved resource report unavailable.');
  const report = await response.json();
  byId('uri').value = report.requestedInput.uri;
  showSelected();
  displayReport(report);
  return report;
}
byId('uri').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('uri').value = 'course://lessons/missing';
  showSelected();
};
byId('repair').onclick = () => {
  byId('uri').value = 'course://lessons/agent-loop';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
showSelected();
byId('inspect').disabled = false;
byId('status').textContent = 'Ready';
byId('progress').textContent =
  'Discover the classroom resources, read a URI and calculate its total duration.';
