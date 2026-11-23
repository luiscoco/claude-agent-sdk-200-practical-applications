const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/input.ts') {
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
function displayReport(report) {
  lastReport = report;
  for (const mode of ['string', 'streaming']) {
    byId(mode + '-answer').textContent = '—';
    byId(mode + '-detail').textContent = 'No ' + mode + ' query in this report.';
  }
  for (const result of report.reports) {
    const card = result.mode === 'string' ? 'string' : 'streaming';
    byId(card + '-answer').textContent = result.success ? result.answer : 'Input failed';
    byId(card + '-detail').textContent =
      result.inputType + ' · ' + (result.initializedModel || 'No initialization observed');
  }
  const latest = report.reports.at(-1);
  byId('expected').textContent = latest.task.expected;
  byId('completed').textContent = report.reports.filter((result) => result.success).length;
  byId('yielded').textContent = report.reports.reduce(
    (count, result) =>
      count + result.inputEvents.filter((event) => event.kind === 'message').length,
    0,
  );
  byId('frames').textContent = report.reports.reduce(
    (count, result) => count + result.events.length,
    0,
  );
  byId('payload').textContent =
    latest.mode === 'string'
      ? JSON.stringify(latest.task.prompt)
      : JSON.stringify(latest.inputEvents, null, 2);
  byId('diagnostics').textContent = JSON.stringify(
    report.reports.map((result) => ({
      mode: result.mode,
      events: result.events,
      generatorError: result.generatorError,
      sdkError: result.sdkError,
    })),
    null,
    2,
  );
  const errors = report.reports
    .filter((result) => result.sdkError)
    .map(
      (result) =>
        'Generator diagnostic\n' +
        (result.generatorError || 'No generator error observed') +
        '\n\nSDK error\n' +
        result.sdkError,
    )
    .join('\n\n');
  byId('sdk-error').textContent = errors;
  byId('sdk-error').classList.toggle('hidden', !errors);
  const allSucceeded = report.reports.every((result) => result.success);
  byId('status').textContent =
    allSucceeded && report.verified
      ? 'Verified'
      : errors
        ? 'Observed input error'
        : 'Review result';
  byId('status').className = 'badge ' + (allSucceeded && report.verified ? 'passed' : 'mismatch');
  byId('verification').textContent =
    'Scenario checks ' + (report.verified ? 'passed' : 'need review');
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    'Completed the selected input-mode experiment and preserved its actual observations.';
}
async function run() {
  lastReport = undefined;
  for (const id of ['left', 'right', 'mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('sdk-error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  for (const id of [
    'expected',
    'completed',
    'yielded',
    'frames',
    'string-answer',
    'streaming-answer',
  ])
    byId(id).textContent = '—';
  byId('payload').textContent = 'Awaiting the input observation.';
  byId('diagnostics').textContent = 'Awaiting the actual SDK outcome.';
  byId('string-detail').textContent = 'Awaiting the selected input experiment.';
  byId('streaming-detail').textContent = 'Awaiting the selected input experiment.';
  byId('verification').textContent = 'Awaiting scenario verification.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: byId('mode').value,
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
    for (const id of ['left', 'right', 'mode', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  byId('left').value = report.reports[0].task.left;
  byId('right').value = report.reports[0].task.right;
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'streaming';
};
window.lesson = { showView, source, restore, report: () => lastReport };
