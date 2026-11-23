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
    'Local tool name in both servers · lookup\nRegistration mode · ' +
    byId('registration').value +
    '\nClassroom fixture SKU · ' +
    byId('sku').value;
}
function displayReport(report) {
  lastReport = report;
  byId('handler-result').textContent = report.expectedNames.length;
  byId('native-result-value').textContent = report.observedNames.length;
  byId('final-result').textContent = report.missingTools.length;
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(
    {
      expected: report.expectedNames,
      discovered: report.observedNames,
      missing: report.missingTools,
    },
    null,
    2,
  );
  byId('native-result').textContent = report.executions
    .map(
      (item) =>
        item.qualifiedName +
        '\n' +
        JSON.stringify({ input: item.input, result: item.outcome }, null, 2),
    )
    .join('\n\n');
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent = [
    'Registration keys · ' + report.registrationKeys.join(', '),
    'Internal metadata names · ' + report.serverMetadataNames.join(', '),
    'Host process ID · ' + report.hostProcessId,
    'Actual handler process IDs · ' + report.executions.map((item) => item.processId).join(', '),
    ...report.hookResults.map((hook) => hook.toolName + ' → ' + JSON.stringify(hook.mcpServer)),
  ].join('\n');
  byId('evidence').textContent = report.calls
    .filter((call) => report.expectedNames.includes(call.name))
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(report.toolResults, null, 2);
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (report.missingTools.length
      ? 'REGISTRATION_INCOMPLETE · Actual SDK discovery is missing ' +
        report.missingTools.join(', ')
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.missingTools.length
      ? 'Missing registration observed'
      : 'Registration verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && !report.missingTools.length ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual SDK discovery, namespaced calls, in-process handler results and final output.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      allowedTools: report.allowedTools,
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
  for (const id of ['sku', 'registration', 'inspect', 'failure', 'repair'])
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
    byId(id).textContent = 'Awaiting actual registration evidence.';
  byId('status').textContent = 'Inspecting registration';
  byId('status').className = 'badge';
  byId('progress').textContent = 'Running the actual SDK with the selected in-process server map.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku: byId('sku').value,
        registration: byId('registration').value,
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
    for (const id of ['sku', 'registration', 'inspect', 'failure', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved registration report unavailable.');
  const report = await response.json();
  byId('sku').value = report.requestedInput.sku;
  byId('registration').value = report.requestedInput.registration;
  showSelected();
  displayReport(report);
  return report;
}
for (const id of ['sku', 'registration']) byId(id).oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('registration').value = 'missing-warehouse';
  showSelected();
};
byId('repair').onclick = () => {
  byId('registration').value = 'complete';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Registration settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run actual discovery and compare both fully qualified lookup names.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
