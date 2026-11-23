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
    'Registered tool · mcp__projects__read_project_notes\nHost-selected classroom identity · ' +
    byId('actor').value +
    '\nActual tool argument · ' +
    JSON.stringify({ projectId: byId('project').value });
}
function displayReport(report) {
  lastReport = report;
  const execution = report.executions[0];
  const native = report.toolResults.find((result) => result.parsedOutcome);
  byId('handler-result').textContent = execution?.decision ?? '—';
  byId('native-result-value').textContent = report.accesses.length;
  byId('final-result').textContent = native?.isError ?? '—';
  byId('execution-count').textContent = report.executions.length;
  byId('handler').textContent = JSON.stringify(
    {
      source: report.principalSource,
      actualPrincipal: report.principal,
      requestedProject: report.requestedInput.projectId,
      actualToolInput: report.expectedToolInput,
    },
    null,
    2,
  );
  byId('native-result').textContent = JSON.stringify(
    {
      actorId: execution?.actorId ?? null,
      role: execution?.role ?? null,
      decision: execution?.decision ?? null,
      protectedReadsBefore: execution?.protectedReadsBefore ?? null,
      protectedReadsAfter: execution?.protectedReadsAfter ?? null,
      nativeIsError: native?.isError ?? null,
    },
    null,
    2,
  );
  byId('final-output').textContent = JSON.stringify(report.output, null, 2);
  byId('checks').textContent = JSON.stringify(
    { ...report.checks, ...report.authorizationChecks },
    null,
    2,
  );
  byId('provenance').textContent = [
    'Host process ID · ' + report.hostProcessId,
    'Actual handler process ID · ' + execution?.processId,
    'Native server provenance · ' + JSON.stringify(report.hookResults[0]?.mcpServer ?? null),
  ].join('\n');
  byId('evidence').textContent = report.calls
    .filter((call) => call.name === report.toolName)
    .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
    .join('\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      accesses: report.accesses,
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
    (report.output?.ok === false ? report.output.errorCode + ' · ' + report.output.message : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.output?.ok
      ? 'Authorized read verified'
      : 'Handler denial observed'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.output?.ok ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual host context, handler authorization, protected-read count and native outcome for the classroom fixture.';
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
  for (const id of ['actor', 'project', 'inspect', 'failure', 'repair']) byId(id).disabled = true;
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
    byId(id).textContent = 'Awaiting actual handler authorization evidence.';
  byId('status').textContent = 'Checking actual authorization';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running the actual SDK project tool with the selected local classroom principal context.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: byId('actor').value,
        projectId: byId('project').value,
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
    for (const id of ['actor', 'project', 'inspect', 'failure', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved authorization report unavailable.');
  const report = await response.json();
  byId('actor').value = report.requestedInput.actor;
  byId('project').value = report.requestedInput.projectId;
  showSelected();
  displayReport(report);
  return report;
}
for (const id of ['actor', 'project']) byId(id).oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('actor').value = 'bob';
  byId('project').value = 'alice-lab';
  showSelected();
};
byId('repair').onclick = () => {
  byId('actor').value = 'alice';
  byId('project').value = 'alice-lab';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Authorization settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run the actual owner read, inspect a cross-owner denial and compare protected-read counts and native results.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
