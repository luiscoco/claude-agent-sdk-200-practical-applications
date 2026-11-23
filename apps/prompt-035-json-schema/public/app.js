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
  const task = configuration.tasks.find((item) => item.name === byId('task').value);
  byId('facts').textContent = task.sourceText;
  const schema =
    byId('mode').value === 'invalid-schema'
      ? { ...configuration.schema, required: 'title' }
      : configuration.schema;
  byId('schema').textContent = JSON.stringify(schema, null, 2);
  byId('schema').scrollTop =
    byId('mode').value === 'invalid-schema' ? byId('schema').scrollHeight : 0;
}
function displayReport(report) {
  lastReport = report;
  byId('facts').textContent = report.task.sourceText;
  byId('schema').textContent = JSON.stringify(report.schema, null, 2);
  byId('schema').scrollTop = report.mode === 'invalid-schema' ? byId('schema').scrollHeight : 0;
  byId('output').textContent =
    report.structuredOutput === null
      ? 'No structured output returned.'
      : JSON.stringify(report.structuredOutput, null, 2);
  byId('shape').textContent = report.structuredOutput === null ? 'Missing' : 'Object';
  byId('fields').textContent =
    report.structuredOutput === null ? '0' : Object.keys(report.structuredOutput).length;
  byId('matched').textContent = report.factsMatched
    ? 'Passed'
    : report.mode === 'invalid-schema' && report.verified
      ? 'Schema rejected'
      : 'Review';
  byId('frames').textContent = report.events.length;
  byId('metadata').textContent = JSON.stringify(
    {
      actualSDKFrames: report.events,
      observedToolNames: report.toolNames,
      nativeSessionId: report.sessionId,
      factsMatched: report.factsMatched,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  const primaryDiagnostic = report.diagnostics
    .split('\n')
    .find((line) => line.startsWith('Error:'));
  const error = report.sdkError
    ? primaryDiagnostic || report.sdkError
    : !report.success
      ? report.answer
      : '';
  byId('error').textContent = error;
  byId('error').classList.toggle('hidden', !error);
  byId('status').textContent =
    report.mode === 'invalid-schema' && report.verified
      ? 'Observed schema error'
      : report.verified
        ? 'Verified'
        : 'Run failed';
  byId('status').className = 'badge ' + (report.verified && report.success ? 'passed' : 'mismatch');
  byId('progress').textContent = report.success
    ? 'Preserved the real structured output and its independent fact checks.'
    : 'Preserved the actual SDK failure diagnostic.';
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
    'Running a real query with the selected JSON Schema output format.';
  byId('output').textContent = 'Awaiting the actual structured result.';
  byId('metadata').textContent = '';
  for (const id of ['shape', 'fields', 'matched', 'frames']) byId(id).textContent = '—';
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
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'valid';
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
    'Extract the supplied facts and compare the real structured result with their independently prepared values.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
