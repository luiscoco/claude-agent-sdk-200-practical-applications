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
    'Registered tool · mcp__lessons__get_lesson_pack\nResource identifier · course://lessons/56/outline\nSelected synthetic classroom pack · ' +
    byId('pack').value;
}
function displayReport(report) {
  lastReport = report;
  const execution = report.executions[0];
  const native = report.toolResults.find((result) => result.parsedOutcome);
  byId('handler-result').textContent = execution?.contentTypes.join(', ') ?? '—';
  byId('native-result-value').textContent = native?.blockTypes.join(', ') ?? '—';
  byId('final-result').textContent = execution?.outcome.sectionCount ?? '—';
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(
    {
      contentTypes: execution?.contentTypes ?? [],
      resourceUri: execution?.outcome.resourceUri ?? '',
      callbackMimeType: execution?.resource?.mimeType ?? null,
      resourceSha256: execution?.outcome.resourceSha256 ?? '',
      outcome: execution?.outcome.ok ? 'Available' : execution?.outcome.errorCode,
    },
    null,
    2,
  );
  byId('native-result').textContent = native?.resource
    ? 'Native resource prefix · [Resource from lessons at ' +
      native.resource.uri +
      ']\n\n' +
      JSON.stringify(native.resource.document, null, 2)
    : JSON.stringify(
        {
          resource: null,
          nativeIsError: native?.isError ?? null,
          outcome: native?.parsedOutcome ?? null,
        },
        null,
        2,
      );
  byId('final-output').textContent = JSON.stringify(
    native?.structuredContent ?? { structuredContent: null, actualFinalOutput: report.output },
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('provenance').textContent = JSON.stringify(
    {
      hostProcessId: report.hostProcessId,
      handlerProcessId: execution?.processId ?? null,
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
    {
      executions: report.executions,
      nativeToolResults: report.toolResults,
      hookResults: report.hookResults,
      finalStructuredOutput: report.output,
    },
    null,
    2,
  );
  byId('error').textContent =
    report.error ||
    report.resultErrors.join('\n') ||
    (execution?.outcome.ok === false
      ? execution.outcome.errorCode +
        ' · Restore the available classroom pack and run a fresh query.'
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? execution?.outcome.ok
      ? 'Rich result verified'
      : 'Missing pack observed'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && execution?.outcome.ok ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual callback blocks, the native resource text conversion, structuredContent metadata and final output.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      actualInitialTools: report.initialTools,
      sdkResultStatus: report.resultStatus,
      sdkConversationSucceeded: report.success,
      finalStructuredOutput: report.output,
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
  for (const id of ['pack', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
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
    byId(id).textContent = 'Awaiting actual rich-result evidence.';
  byId('status').textContent = 'Loading rich result';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running the actual SDK agent and the synthetic classroom resource callback.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack: byId('pack').value,
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
    for (const id of ['pack', 'inspect', 'failure', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved rich-result report unavailable.');
  const report = await response.json();
  byId('pack').value = report.requestedInput.pack;
  showSelected();
  displayReport(report);
  return report;
}
byId('pack').oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('pack').value = 'missing';
  showSelected();
};
byId('repair').onclick = () => {
  byId('pack').value = 'available';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Resource settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run the actual resource tool and compare callback content, native text conversion and structured metadata.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
