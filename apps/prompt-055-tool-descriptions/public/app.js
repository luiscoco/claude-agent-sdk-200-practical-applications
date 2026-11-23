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
    'Same local tool names · lookup_record_a and lookup_record_b\nDescription mode · ' +
    byId('description-mode').value +
    '\nEach run uses actual SDK queries against local classroom invoice and policy fixtures.';
}
function displayReport(report) {
  lastReport = report;
  byId('handler-result').textContent = report.correct;
  byId('native-result-value').textContent = report.total;
  byId('final-result').textContent = report.total - report.correct;
  byId('execution-count').textContent = report.trials.reduce(
    (sum, trial) => sum + trial.executions.length,
    0,
  );
  byId('handler').textContent =
    'lookup_record_a\n' +
    report.actualDescriptions.invoice +
    '\n\nlookup_record_b\n' +
    report.actualDescriptions.policy;
  byId('native-result').textContent = report.trials
    .map(
      (trial) =>
        trial.question +
        '\nExpected · ' +
        trial.expectedTool.split('__').at(-1) +
        '\nObserved · ' +
        (trial.selectedTool?.split('__').at(-1) ?? 'Unavailable') +
        '\n' +
        (trial.selectionCorrect ? '✓ Correct choice' : '✕ Selection mismatch'),
    )
    .join('\n\n');
  const inspected = report.trials.find(trial => !trial.selectionCorrect) ?? report.trials[0];
  byId('final-output').textContent = inspected ? inspected.question + '\n\n' + JSON.stringify(inspected.output, null, 2) : 'Unavailable';
  byId('checks').textContent = report.trials
    .map(
      (trial) =>
        trial.id +
        ' · ' +
        Object.entries(trial.checks)
          .map(([name, passed]) => name + ' ' + (passed ? '✓' : '✕'))
          .join(' | '),
    )
    .join('\n\n');
  byId('provenance').textContent = [
    'Host process ID · ' + report.hostProcessId,
    ...report.trials.map(
      (trial) =>
        trial.id +
        ' · handler ' +
        trial.executions[0]?.processId +
        ' · ' +
        JSON.stringify(trial.hookResults[0]?.mcpServer ?? null),
    ),
  ].join('\n');
  byId('evidence').textContent = report.trials
    .map(
      (trial) =>
        trial.id +
        '\n' +
        trial.calls
          .filter((call) => Object.values(report.toolNames).includes(call.name))
          .map((call) => call.name + '(' + JSON.stringify(call.input) + ')')
          .join('\n'),
    )
    .join('\n\n');
  byId('tool-results').textContent = JSON.stringify(report.trials, null, 2);
  const failure = report.trials.find((trial) => !trial.flowVerified);
  byId('error').textContent = failure
    ? failure.error || failure.resultErrors.join('\n') || 'Inspect the actual tool flow checks.'
    : report.allSelectionsCorrect
      ? ''
      : 'SELECTION_MISMATCH · ' +
        (report.total - report.correct) +
        ' of ' +
        report.total +
        ' actual choices differed from the labelled expected route.';
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.allSelectionsCorrect
      ? 'All tested choices matched'
      : 'Selection mistakes observed'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.allSelectionsCorrect ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Observed ' +
    report.correct +
    ' correct choices out of ' +
    report.total +
    ' actual trials. This score describes the displayed classroom sample.';
  byId('metadata').textContent = JSON.stringify(
    {
      mode: report.requestedInput.descriptionMode,
      suite: report.requestedInput.suite,
      nativeSessionIds: report.trials.map((trial) => trial.sessionId),
      actualAccuracy: report.accuracy,
      flowVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['description-mode', 'suite', 'inspect', 'failure', 'repair'])
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
    byId(id).textContent = 'Awaiting actual description-comparison evidence.';
  byId('status').textContent = 'Testing actual choices';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running a fresh actual SDK query for each question in the selected suite.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descriptionMode: byId('description-mode').value,
        suite: byId('suite').value,
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
    for (const id of ['description-mode', 'suite', 'inspect', 'failure', 'repair'])
      byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved description report unavailable.');
  const report = await response.json();
  byId('description-mode').value = report.requestedInput.descriptionMode;
  byId('suite').value = report.requestedInput.suite;
  showSelected();
  displayReport(report);
  return report;
}
for (const id of ['description-mode', 'suite']) byId(id).oninput = showSelected;
byId('inspect').onclick = run;
byId('failure').onclick = () => {
  byId('description-mode').value = 'vague';
  showSelected();
};
byId('repair').onclick = () => {
  byId('description-mode').value = 'specific';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Description settings unavailable.');
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run the actual baseline suite, improve the descriptions and compare measured choices.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
