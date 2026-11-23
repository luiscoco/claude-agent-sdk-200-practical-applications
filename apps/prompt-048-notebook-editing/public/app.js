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

const cellSource = (cell) => (Array.isArray(cell.source) ? cell.source.join('') : cell.source);
function showSelected() {
  byId('facts').textContent =
    'Native NotebookEdit · edit_mode replace · cell_id ' +
    (byId('mode').value === 'missing' ? 'missing-cell' : 'pricing-cell') +
    '\nRequested calculation · sum(prices_cents) - discount_cents';
}
function showPricing(id, notebook) {
  const cell = notebook.cells.find((cell) => cell.id === 'pricing-cell');
  byId(id).replaceChildren();
  cellSource(cell)
    .split('\n')
    .forEach((line) => {
      const row = element('span', line || ' ');
      row.className = 'source-line' + (line.includes('return sum(') ? ' changed' : '');
      byId(id).append(row);
    });
}
function displayReport(report) {
  lastReport = report;
  byId('before-total').textContent =
    report.beforeExecution.result?.exampleTotalCents ?? 'Unavailable';
  byId('after-total').textContent =
    report.afterExecution.result?.exampleTotalCents ?? 'Unavailable';
  byId('cell-count').textContent = report.after.notebook.cells.length;
  byId('preserved').textContent = report.checks.verified ? 'Passed' : 'Review';
  showPricing('before-source', report.before.notebook);
  showPricing('after-source', report.after.notebook);
  byId('before-execution').textContent = JSON.stringify(
    report.beforeExecution.result ?? report.beforeExecution.error,
    null,
    2,
  );
  byId('after-execution').textContent = JSON.stringify(
    report.afterExecution.result ?? report.afterExecution.error,
    null,
    2,
  );
  byId('checks').textContent = JSON.stringify(report.checks, null, 2);
  byId('other-cells').replaceChildren();
  for (const cell of report.after.notebook.cells.filter((cell) => cell.id !== 'pricing-cell')) {
    const article = document.createElement('article');
    article.append(
      element('h4', cell.id + ' · ' + cell.cell_type),
      element('pre', cellSource(cell)),
      element('small', 'Actual cell metadata · ' + JSON.stringify(cell.metadata)),
    );
    byId('other-cells').append(article);
  }
  byId('evidence').textContent = report.calls
    .map((call, index) => {
      const input = call.input;
      return (
        `${index + 1}. ${call.name}(${JSON.stringify(input.file_path ?? input.notebook_path)})` +
        (call.name === 'NotebookEdit'
          ? `\ncell_id = ${JSON.stringify(input.cell_id)} · edit_mode = ${JSON.stringify(input.edit_mode)}\nnew_source = ${JSON.stringify(input.new_source)}`
          : '')
      );
    })
    .join('\n\n');
  byId('tool-results').textContent = JSON.stringify(
    { toolResults: report.toolResults, nativeEdits: report.nativeEdits },
    null,
    2,
  );
  const nativeError = report.toolResults.findLast((result) => result.isError);
  byId('error').textContent =
    report.error ||
    report.afterExecution.error ||
    (nativeError
      ? typeof nativeError.content === 'string'
        ? nativeError.content
        : JSON.stringify(nativeError.content)
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.mode === 'missing'
      ? 'Missing cell rejected'
      : 'Verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.mode === 'edit' ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual notebook cells, native Read/NotebookEdit results and independently executed Python behavior.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      originalSha256: report.before.sha256,
      actualSha256: report.after.sha256,
      originalBytes: report.before.bytes,
      actualBytes: report.after.bytes,
      nativeEditSucceeded: report.nativeEditSucceeded,
      missingCellRejected: report.missingCellRejected,
      actualBehaviorVerified: report.behaviorVerified,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('notebook-download').href = '/api/notebook/' + report.id;
  for (const id of ['download', 'notebook-download']) byId(id).classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download', 'notebook-download']) byId(id).classList.add('hidden');
  for (const id of ['before-total', 'after-total', 'cell-count', 'preserved'])
    byId(id).textContent = '—';
  for (const id of [
    'before-source',
    'after-source',
    'before-execution',
    'after-execution',
    'checks',
    'evidence',
    'tool-results',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting actual notebook evidence.';
  byId('other-cells').replaceChildren();
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Reading and editing the actual notebook, verifying cells and executing the trusted classroom pricing source through Python.';
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
  if (!response.ok) throw new Error('Saved notebook report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  showSelected();
  displayReport(report);
  return report;
}
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'edit';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom notebook unavailable.');
  const config = await response.json();
  showPricing('before-source', config.notebook);
  showPricing('after-source', config.notebook);
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Run native Read and NotebookEdit, verify the changed cell and inspect actual Python execution.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
