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

let configuration;
function showSelected() {
  if (!configuration) return;
  const oldLine =
    byId('mode').value === 'stale' ? configuration.staleLine : configuration.originalLine;
  byId('facts').textContent =
    'Requested replacement · ' +
    oldLine +
    ' → ' +
    configuration.editedLine +
    '\nBehavior test · imported validateDiscount(discountCents, 1000)';
}
function showSource(id, text) {
  byId(id).replaceChildren();
  text.split('\n').forEach((line) => {
    const row = element('span', line || ' ');
    row.className =
      'source-line' + (line.includes('export const MAX_DISCOUNT_CENTS') ? ' changed' : '');
    byId(id).append(row);
  });
}
function displayReport(report) {
  lastReport = report;
  byId('before-limit').textContent = report.beforeBehavior.limitCents ?? 'Unavailable';
  byId('after-limit').textContent = report.afterBehavior.limitCents ?? 'Unavailable';
  byId('preserved').textContent = report.exactChange ? 'Passed' : 'Mismatch';
  byId('diff-code').textContent = report.diff.exitCode ?? 'Unavailable';
  byId('before-behavior').textContent = JSON.stringify(report.beforeBehavior, null, 2);
  byId('after-behavior').textContent = JSON.stringify(report.afterBehavior, null, 2);
  byId('diff').replaceChildren();
  if (report.diff.stdout)
    report.diff.stdout.split('\n').forEach((line) => {
      const row = element('span', line || ' ');
      row.className =
        'diff-line' +
        (line.startsWith('+') && !line.startsWith('+++')
          ? ' added'
          : line.startsWith('-') && !line.startsWith('---')
            ? ' removed'
            : '');
      byId('diff').append(row);
    });
  else byId('diff').textContent = report.diff.error || 'Git returned no source changes.';
  showSource('before-source', report.before.text);
  showSource('after-source', report.after.text);
  byId('evidence').textContent = report.calls
    .map((call, index) => {
      const input = call.input ?? {};
      return (
        index +
        1 +
        '. ' +
        call.name +
        '(' +
        JSON.stringify(input.file_path ?? null) +
        ')' +
        (call.name === 'Edit'
          ? '\nold_string = ' +
            JSON.stringify(input.old_string) +
            '\nnew_string = ' +
            JSON.stringify(input.new_string)
          : '')
      );
    })
    .join('\n\n');
  byId('tool-results').textContent = JSON.stringify(report.toolResults, null, 2);
  const nativeError =
    report.mode === 'stale' || !report.verified
      ? report.toolResults.findLast((result) => result.isError)
      : undefined;
  byId('error').textContent =
    report.error ||
    report.diff.error ||
    (nativeError
      ? typeof nativeError.content === 'string'
        ? nativeError.content
        : JSON.stringify(nativeError.content)
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.mode === 'stale'
      ? 'Stale edit rejected'
      : 'Verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.mode === 'edit' ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual Read/Edit results, exact source comparison, real Git diff and imported function behavior.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      originalSha256: report.before.sha256,
      actualSha256: report.after.sha256,
      exactSourceReplacement: report.exactChange,
      nativeEditSucceeded: report.nativeEditSucceeded,
      nativeEditFailed: report.nativeEditFailed,
      actualDiffCommand: report.diff.command,
      diffExitCode: report.diff.exitCode,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('file-download').href = '/api/file/' + report.id;
  byId('file-download').classList.remove('hidden');
  byId('diff-download').href = '/api/diff/' + report.id;
  byId('diff-download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'discount', 'inspect', 'repair']) byId(id).disabled = true;
  for (const id of ['error', 'download', 'file-download', 'diff-download'])
    byId(id).classList.add('hidden');
  for (const id of ['before-source', 'after-source'])
    byId(id).textContent = 'Awaiting the actual source snapshot.';
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Reading and editing the working source, then capturing its diff and executing the actual edited function.';
  for (const id of ['before-limit', 'after-limit', 'preserved', 'diff-code'])
    byId(id).textContent = '—';
  for (const id of [
    'before-behavior',
    'after-behavior',
    'diff',
    'evidence',
    'tool-results',
    'metadata',
  ])
    byId(id).textContent = 'Awaiting the actual source edit.';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: byId('mode').value,
        discountCents: byId('discount').valueAsNumber,
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
    for (const id of ['mode', 'discount', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.mode;
  byId('discount').value = report.discountCents;
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
  if (!response.ok) throw new Error('Classroom source unavailable.');
  configuration = await response.json();
  showSource('before-source', configuration.source);
  showSource('after-source', configuration.source);
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Apply the precise native Edit and inspect the actual source diff and behavior.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
