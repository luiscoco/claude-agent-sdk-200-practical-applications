const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/agent.py') {
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
    'Registered tool · mcp__calculator__calculate\nRequested typed input · ' +
    JSON.stringify({
      operation: byId('operation').value,
      left: byId('left').valueAsNumber,
      right: byId('right').valueAsNumber,
    });
}
const outcomeLabel = (outcome) =>
  outcome ? (outcome.ok ? String(outcome.result) : outcome.errorCode) : 'Unavailable';
function displayReport(report) {
  lastReport = report;
  const execution = report.executions[0];
  const native = report.toolResults.find((result) => result.parsedOutcome);
  byId('handler-result').textContent = outcomeLabel(execution?.outcome);
  byId('native-result-value').textContent = outcomeLabel(native?.parsedOutcome);
  byId('final-result').textContent = outcomeLabel(report.output);
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(
    execution
      ? { input: execution.input, outcome: execution.outcome, processId: execution.processId }
      : null,
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      outcome: native?.parsedOutcome ?? null,
      isError: native?.isError ?? null,
      contentType: native?.contentType ?? null,
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent = JSON.stringify(
    {
      actualHostProcessId: report.hostProcessId,
      actualHandlerProcessId: execution?.processId ?? null,
      nativeMcpServer: report.hookResults.find((result) => result.mcpServer)?.mcpServer ?? null,
    },
    null,
    2,
  );
  byId('evidence').textContent = report.calls
    .filter((call) => call.name === report.toolName)
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    { toolResults: report.toolResults, hookResults: report.hookResults },
    null,
    2,
  );
  const nativeError =
    execution?.outcome.ok === false || !report.verified
      ? report.toolResults.findLast((result) => result.isError)
      : undefined;
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (nativeError
      ? typeof nativeError.content === 'string'
        ? nativeError.content
        : JSON.stringify(nativeError.content)
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? execution?.outcome.ok
      ? 'Tool flow verified'
      : 'Tool error observed'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && execution?.outcome.ok ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved the actual typed handler execution, native MCP outcome, server provenance and final structured result.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      actualPythonVersion: report.pythonVersion,
      actualSdkVersion: report.sdkVersion,
      actualNativeVersion: report.nativeVersion,
      actualPydanticVersion: report.pydanticVersion,
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
  for (const id of ['operation', 'left', 'right', 'inspect', 'failure', 'repair'])
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
    byId(id).textContent = 'Awaiting actual typed-tool evidence.';
  byId('status').textContent = 'Calling tool';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running the real SDK agent, its typed in-process calculator handler and native result checks.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: byId('operation').value,
        left: byId('left').valueAsNumber,
        right: byId('right').valueAsNumber,
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
    for (const id of ['operation', 'left', 'right', 'inspect', 'failure', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved calculator report unavailable.');
  const report = await response.json();
  byId('operation').value = report.requestedInput.operation;
  byId('left').value = report.requestedInput.left;
  byId('right').value = report.requestedInput.right;
  showSelected();
  displayReport(report);
  return report;
}
for (const id of ['operation', 'left', 'right']) byId(id).oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('operation').value = 'divide';
  byId('left').value = '24';
  byId('right').value = '0';
  showSelected();
};
byId('repair').onclick = () => {
  byId('operation').value = 'add';
  byId('left').value = '24';
  byId('right').value = '18';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Calculator settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run an actual typed calculator tool and compare the handler, native result and structured agent outcome.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
