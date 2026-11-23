const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/schema.ts') {
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
let configuration;
function showSelected() {
  if (!configuration) return;
  byId('facts').textContent = configuration.tasks.find(
    (task) => task.name === byId('task').value,
  ).sourceText;
  byId('generated').textContent = JSON.stringify(configuration.schema, null, 2);
}
function displayReport(report) {
  lastReport = report;
  byId('facts').textContent = report.task.sourceText;
  byId('raw').textContent = JSON.stringify(report.rawOutput, null, 2);
  byId('candidate').textContent = JSON.stringify(report.candidate, null, 2);
  byId('typed').textContent = report.typedOutput
    ? JSON.stringify(report.typedOutput, null, 2)
    : 'Typed consumer withheld at the validation boundary.';
  byId('generated').textContent = JSON.stringify(report.jsonSchema, null, 2);
  byId('sdk').textContent = report.success ? 'Completed' : 'Failed';
  byId('validation').textContent = report.validationPassed ? 'Passed' : 'Rejected';
  byId('consumer').textContent = report.typedConsumerCalled ? 'Called' : 'Withheld';
  byId('matched').textContent = report.rawFactsMatched ? 'Passed' : 'Review';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      validationPassed: report.validationPassed,
      typedConsumerCalled: report.typedConsumerCalled,
      rawFactsMatched: report.rawFactsMatched,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  const validationError = report.issues
    .map((issue) => issue.path.join('.') + ' · ' + issue.message)
    .join('\n');
  byId('error').textContent = report.error || (!report.success ? report.answer : validationError);
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  const rejected = report.mode === 'corrupt-boundary' && report.verified;
  byId('status').textContent = rejected
    ? 'Boundary rejected'
    : report.verified
      ? 'Verified'
      : 'Run failed';
  byId('status').className = 'badge ' + (report.verified && !rejected ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved native output, boundary input, actual Zod issues and typed application use.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['task', 'mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Running a real structured query, then validating its application-boundary input.';
  for (const id of ['raw', 'candidate', 'typed'])
    byId(id).textContent = 'Awaiting the actual query and validation.';
  for (const id of ['sdk', 'validation', 'consumer', 'matched']) byId(id).textContent = '—';
  byId('metadata').textContent = '';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, task: byId('task').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['task', 'mode', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  byId('task').value = report.task.name;
  displayReport(report);
  return report;
}
byId('task').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'valid';
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom configuration unavailable.');
  configuration = await response.json();
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Validate the unknown structured output before invoking the typed application consumer.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
