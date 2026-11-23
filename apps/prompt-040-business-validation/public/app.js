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
  const task = configuration.tasks.find((item) => item.mode === byId('mode').value);
  byId('facts').textContent = task.sourceText;
  byId('reference').textContent = JSON.stringify(task.reference, null, 2);
}
function displayReport(report) {
  lastReport = report;
  byId('reference').textContent = JSON.stringify(report.task.reference, null, 2);
  byId('raw').textContent = JSON.stringify(report.rawOutput, null, 2);
  byId('business').textContent = report.business
    ? report.business.passed
      ? 'All ' +
        report.business.checks.length +
        ' independent application checks passed.\n\nCalculated subtotal: ' +
        report.business.calculatedSubtotal +
        ' cents.'
      : JSON.stringify(report.business.failures, null, 2)
    : 'Business validation withheld because native/schema validation failed.';
  byId('checks').textContent = JSON.stringify(report.business?.checks ?? [], null, 2);
  byId('typed').textContent = report.typedOutput
    ? JSON.stringify(report.typedOutput, null, 2)
    : 'Checkout withheld. The invoice must pass native, schema and independent business validation.';
  byId('sdk').textContent = report.success ? 'Completed' : 'Failed';
  byId('validation').textContent = report.schemaPassed ? 'Passed' : 'Rejected';
  byId('business-status').textContent = report.business?.passed
    ? 'Passed'
    : report.business
      ? 'Rejected'
      : 'Withheld';
  byId('consumer').textContent = report.typedOutput ? 'Approved' : 'Withheld';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      schemaPassed: report.schemaPassed,
      businessPassed: report.business?.passed,
      suppliedValuesPreserved: report.suppliedValuesPreserved,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('error').textContent =
    report.error || (!report.schemaPassed ? JSON.stringify(report.schemaIssues) : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.typedOutput
      ? 'Verified'
      : 'Business rejected'
    : 'Review';
  byId('status').className = 'badge ' + (report.typedOutput ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual extracted values and compared them with the independent catalog, order and arithmetic rules.';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Extracting the actual supplied invoice, then checking its structure and business rules.';
  for (const id of ['raw', 'business', 'checks', 'typed'])
    byId(id).textContent = 'Awaiting the actual query and validation.';
  for (const id of ['sdk', 'validation', 'business-status', 'consumer']) byId(id).textContent = '—';
  byId('metadata').textContent = '';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'correct';
  showSelected();
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
    'Run a real extraction, validate its schema, then check the independent application facts.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
