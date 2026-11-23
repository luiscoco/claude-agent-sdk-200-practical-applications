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
    'Explicit file · catalog\nProject .mcp.json · unintended\nSelected mode · ' +
    byId('mode').value +
    '\nActual catalog slug · ' +
    byId('slug').value;
}
function displayReport(report) {
  lastReport = report;
  const invalid = report.stage === 'configuration-preflight';
  byId('handler-result').textContent = invalid ? 'invalid file' : String(report.strictEnabled);
  byId('native-result-value').textContent = report.nativeServerStatus.length;
  byId('final-result').textContent = invalid ? '—' : String(report.unintendedDiscovered);
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(
    {
      stage: report.stage,
      sdkStarted: report.sdkStarted,
      strictMcpConfig: report.strictEnabled ?? null,
      explicitServers: report.explicitServerNames ?? [],
      configSha256: report.configSha256 ?? null,
    },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    report.nativeServerStatus.map((server) => ({
      name: server.name,
      status: server.status,
      scope: server.scope,
      source: server.source,
    })),
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(
    { ...report.checks, ...report.connectionChecks },
    null,
    2,
  );
  byId('provenance').textContent =
    'Actual configured file · ' +
    (report.configFile ?? 'Invalid classroom JSON') +
    '\nUnintended server handler audit present · ' +
    (report.unintendedAuditPresent ?? '—');
  byId('evidence').textContent = report.calls
    .filter((call) => call.name.startsWith('mcp__'))
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      explicitConfiguration: report.explicitConfiguration ?? null,
      nativeServerStatus: report.nativeServerStatus,
      executions: report.executions,
      nativeToolResults: report.toolResults,
      hookResults: report.hookResults,
    },
    null,
    2,
  );
  byId('error').textContent = report.error || report.resultErrors.join('\n');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? invalid
      ? 'Invalid config observed'
      : report.strictEnabled
        ? 'Strict scope verified'
        : 'Merged scope observed'
    : 'Review';
  byId('status').className = 'badge ' + (report.verified && !invalid ? 'passed' : 'mismatch');
  byId('progress').textContent = invalid
    ? 'Actual file parsing failed before SDK inference. Restore strict configuration to retry.'
    : 'Compare actual native discovery with the explicit file and separate project configuration.';
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
  for (const id of ['mode', 'slug', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
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
    byId(id).textContent = 'Awaiting actual file loading and native server discovery.';
  byId('status').textContent = 'Loading MCP configuration';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Loading the actual explicit file and comparing native project discovery with the selected strict mode.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: byId('mode').value,
        slug: byId('slug').value,
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
    for (const id of ['mode', 'slug', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved configuration report unavailable.');
  const report = await response.json();
  byId('slug').value = report.requestedInput.slug;
  byId('mode').value = report.requestedInput.mode;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').oninput = showSelected;
byId('slug').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('mode').value = 'malformed';
  showSelected();
};
byId('repair').onclick = () => {
  byId('mode').value = 'strict';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('MCP configuration settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Compare merged project discovery with strict explicit configuration, then repair a malformed file.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
