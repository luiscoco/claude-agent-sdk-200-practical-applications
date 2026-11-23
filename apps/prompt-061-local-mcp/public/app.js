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
    'Transport · stdio · Separate child process\nRegistered tool · mcp__catalog__get_lesson\nActual tool argument · ' +
    JSON.stringify({ slug: byId('slug').value });
}
function displayReport(report) {
  lastReport = report;
  const execution = report.executions[0];
  const native = report.toolResults.find((result) => result.parsedOutcome);
  const status = report.nativeServerStatus.find((server) => server.name === 'catalog');
  byId('handler-result').textContent = status?.status ?? '—';
  byId('native-result-value').textContent = execution?.processId ?? '—';
  byId('final-result').textContent = native?.isError ?? '—';
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(
    {
      type: report.connection.type,
      command: report.connection.command,
      script: 'src/mcp-server.mjs',
      input: report.expectedToolInput,
    },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      status: status?.status,
      serverInfo: status?.serverInfo,
      hostProcessId: report.hostProcessId,
      childProcessId: execution?.processId,
      nativeIsError: native?.isError,
    },
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
    'Transport · ' +
    report.connection.type +
    '\nActual MCP status · ' +
    JSON.stringify(status?.serverInfo ?? null);
  byId('evidence').textContent = report.calls
    .filter((call) => call.name === report.toolName)
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      nativeServerStatus: report.nativeServerStatus,
      executions: report.executions,
      nativeToolResults: report.toolResults,
      hookResults: report.hookResults,
      visibleAssistantText: report.assistantText,
    },
    null,
    2,
  );
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (report.output?.ok === false
      ? report.output.errorCode + ' · Choose a slug present in the classroom catalog.'
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.output?.ok
      ? 'Stdio call verified'
      : 'Missing lesson observed'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.output?.ok ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual stdio connection, child-process audit and native outcome for the classroom fixture.';
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
  for (const id of ['slug', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
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
    byId(id).textContent = 'Awaiting actual stdio connection and invocation evidence.';
  byId('status').textContent = 'Calling actual stdio server';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running the actual SDK and its local MCP child process against the classroom catalog.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
    for (const id of ['slug', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved stdio report unavailable.');
  const report = await response.json();
  byId('slug').value = report.requestedInput.slug;
  showSelected();
  displayReport(report);
  return report;
}
byId('slug').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('slug').value = 'missing';
  showSelected();
};
byId('repair').onclick = () => {
  byId('slug').value = 'local-mcp';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Local MCP settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run a known lesson lookup, inspect a missing lesson and compare actual connection status, child process and native results.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
