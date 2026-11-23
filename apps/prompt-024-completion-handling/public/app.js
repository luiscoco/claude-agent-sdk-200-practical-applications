const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/outcome.ts') {
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
  byId('category').textContent = report.outcome.category;
  byId('subtype').textContent = report.outcome.resultSubtype ?? 'null';
  byId('is-error').textContent = String(report.outcome.resultIsError);
  byId('cleanup').textContent = String(report.cleanupCalled);
  const native = report.nativeResult;
  byId('native').textContent = JSON.stringify(
    native
      ? {
          type: native.type,
          subtype: native.subtype,
          is_error: native.is_error,
          ...(native.subtype === 'success' ? { result: native.result } : { errors: native.errors }),
        }
      : { exceptionName: report.outcome.exceptionName, message: report.outcome.message },
    null,
    2,
  );
  byId('outcome').textContent = JSON.stringify(report.outcome, null, 2);
  byId('status').textContent = report.outcome.ok ? 'Completed' : 'Handled error';
  byId('status').className = 'badge ' + (report.outcome.ok ? 'passed' : 'mismatch');
  byId('verification').textContent =
    'Scenario checks ' +
    (report.verified ? 'passed' : 'need review') +
    ' · ' +
    report.observations.length +
    ' actual SDK messages observed';
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    'Preserved the actual SDK outcome and the consistent application response.';
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  for (const id of ['category', 'subtype', 'is-error', 'cleanup']) byId(id).textContent = '—';
  byId('native').textContent = 'Awaiting the actual SDK result or exception.';
  byId('outcome').textContent = 'Awaiting normalization.';
  byId('verification').textContent = 'Awaiting the expected completion-category checks.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.outcome?.message || 'Request failed.');
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
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'success';
};
window.lesson = { showView, source, restore, report: () => lastReport };
