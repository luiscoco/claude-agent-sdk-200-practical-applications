const byId = (id) => document.getElementById(id);
let lastReport;
function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}
async function source(file = 'src/report.ts') {
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
  byId('before').textContent =
    report.before.exists === false ? 'Absent' : report.before.exists ? 'Present' : 'Unknown';
  byId('after').textContent = report.after.exists
    ? 'Created'
    : report.after.exists === false
      ? 'Absent'
      : 'Unknown';
  byId('content-check').textContent = report.after.exists
    ? report.contentMatched
      ? 'Passed'
      : 'Mismatch'
    : 'Withheld';
  byId('hash-check').textContent = report.after.exists
    ? report.after.sha256 === report.expectedSha256
      ? 'Passed'
      : 'Mismatch'
    : 'Withheld';
  byId('expected').textContent = report.expectedContent;
  byId('actual').textContent = report.after.content ?? 'The actual report file is absent.';
  byId('hashes').textContent = JSON.stringify(
    {
      expectedSha256: report.expectedSha256,
      actualSha256: report.after.sha256,
      actualBytes: report.after.bytes,
      contentMatched: report.contentMatched,
    },
    null,
    2,
  );
  byId('evidence').textContent = report.calls
    .map((call, index) => {
      const length =
        typeof call.input?.content === 'string'
          ? ' · content length ' + call.input.content.length
          : '';
      return (
        index +
        1 +
        '. ' +
        call.name +
        '(' +
        JSON.stringify(call.input?.file_path ?? null) +
        ')' +
        length
      );
    })
    .join('\n\n');
  byId('tool-results').textContent = JSON.stringify(
    {
      actualToolResults: report.toolResults,
      actualPolicyDecisions: report.decisions,
      nativePermissionDenials: report.permissionDenials,
    },
    null,
    2,
  );
  const nativeError = report.toolResults.find((result) => result.isError);
  byId('error').textContent =
    report.error ||
    report.after.error ||
    (nativeError
      ? typeof nativeError.content === 'string'
        ? nativeError.content
        : JSON.stringify(nativeError.content)
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.mode === 'blocked'
      ? 'Write denied'
      : 'Verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && report.mode !== 'blocked' ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved actual native tool calls, file existence, exact read-back and content hashes.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      writeDenied: report.writeDenied,
      nativeRunSucceeded: report.success,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
  byId('file-download').href = '/api/file/' + report.id;
  byId('file-download').classList.toggle('hidden', !report.after.exists);
}
async function run() {
  lastReport = undefined;
  for (const id of ['mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('file-download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Creating a fresh report with native Write, then reading and verifying its saved contents.';
  for (const id of ['before', 'after', 'content-check', 'hash-check']) byId(id).textContent = '—';
  byId('actual').textContent = 'Awaiting actual native file execution.';
  byId('hashes').textContent = '';
  byId('evidence').textContent = '';
  byId('tool-results').textContent = '';
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
  displayReport(report);
  return report;
}
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'create';
};
window.lesson = { showView, source, restore, report: () => lastReport };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Report specification unavailable.');
  const configuration = await response.json();
  byId('expected').textContent = configuration.expectedContent;
  byId('facts').textContent =
    'Target · fresh runs/write-*/report.md\nVerification · exact UTF-8 content and SHA-256';
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Create a new report, inspect the actual native calls and verify the saved content.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
