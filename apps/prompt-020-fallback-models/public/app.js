const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/config.ts') {
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
  byId('primary').textContent = report.selected.model;
  byId('backups').textContent = report.selected.fallbackModel || 'Disabled';
  byId('final-model').textContent = report.finalModel || 'No successful response';
  byId('switches').textContent = report.fallbackNotices.length;
  byId('answer').textContent = report.success ? report.answer : 'Request failed';
  byId('failure').textContent = report.fallbackNotices.length
    ? report.fallbackNotices
        .map((event) => event.original_model + '\nReason · ' + event.trigger + '\n' + event.content)
        .join('\n\n')
    : report.error || 'The configured primary completed this request.';
  byId('events').replaceChildren();
  for (const event of report.events) {
    const row = document.createElement('article');
    row.className = 'event';
    row.append(element('strong', event.subtype || event.type));
    row.append(element('p', event.content || event.text || event.model || JSON.stringify(event)));
    if (event.fallback_model)
      row.append(
        element(
          'code',
          event.original_model + ' → ' + event.fallback_model + ' · ' + event.trigger,
        ),
      );
    byId('events').append(row);
  }
  byId('status').textContent = report.success
    ? report.verified
      ? 'Verified'
      : 'Review result'
    : 'Observed failure';
  byId('status').className = 'badge ' + (report.success && report.verified ? 'passed' : 'mismatch');
  byId('verification').textContent =
    'Scenario checks ' +
    (report.verified ? 'passed' : 'need review') +
    ' · Native runtime ' +
    report.nativeVersion;
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('progress').textContent =
    'Saved the actual failure reason, native switches, and response outcome.';
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  for (const id of ['primary', 'backups', 'final-model', 'switches']) byId(id).textContent = '—';
  byId('answer').textContent = 'Awaiting the SDK result.';
  byId('failure').textContent = 'Awaiting the native failure reason.';
  byId('events').replaceChildren();
  byId('verification').textContent = 'Awaiting scenario checks.';
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
    byId('progress').textContent = 'Restore a valid configuration and run a fresh experiment.';
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
  byId('mode').value = 'fallback';
};
window.lesson = { showView, source, restore, report: () => lastReport };
