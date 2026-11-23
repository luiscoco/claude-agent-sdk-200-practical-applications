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
  byId('facts').textContent =
    'Requested path · fixtures/' +
    (byId('mode').value === 'missing' ? 'missing-checkout.ts' : 'checkout.ts') +
    '\nQuestion · ' +
    byId('topic').selectedOptions[0].textContent;
}
function highlight(section) {
  for (const row of document.querySelectorAll('.target-line'))
    row.classList.toggle(
      'focus',
      Number(row.dataset.line) >= section.startLine && Number(row.dataset.line) <= section.endLine,
    );
  const first = document.querySelector('.target-line[data-line="' + section.startLine + '"]');
  if (first)
    byId('target-source').scrollTop = Math.max(
      0,
      first.offsetTop - byId('target-source').offsetTop - 50,
    );
}
function displaySource(lines) {
  byId('target-source').replaceChildren();
  lines.forEach((line, index) => {
    const row = element('span', line || ' ');
    row.className = 'target-line';
    row.dataset.line = index + 1;
    byId('target-source').append(row);
  });
}
function displayReport(report) {
  lastReport = report;
  displaySource(report.sourceLines);
  byId('read-count').textContent = report.calls.length;
  byId('read-status').textContent = report.readFailed
    ? 'Failed'
    : report.pathMatched
      ? 'Read'
      : 'Unverified';
  byId('validation').textContent = report.schemaPassed ? 'Passed' : 'Rejected';
  byId('range-status').textContent = report.readFailed
    ? 'Withheld'
    : report.sectionsVerified
      ? 'Passed'
      : 'Review';
  byId('answer').textContent =
    report.parsedData?.summary ?? 'A validated source summary was unavailable.';
  byId('sections').replaceChildren();
  for (const section of report.parsedData?.sections ?? []) {
    const wrapper = element('div', '');
    const button = element(
      'button',
      section.name + ' · lines ' + section.startLine + '–' + section.endLine,
    );
    button.className = 'secondary';
    button.onclick = () => highlight(section);
    wrapper.append(button, element('p', section.explanation));
    byId('sections').append(wrapper);
  }
  const declaration =
    report.sourceLines.findIndex((line) =>
      line.includes('export function ' + report.task.expectedFunction + '('),
    ) + 1;
  const relevant = report.parsedData?.sections.find(
    (section) =>
      section.name.includes(report.task.expectedFunction) &&
      section.startLine <= declaration &&
      section.endLine >= declaration,
  );
  if (relevant) highlight(relevant);
  byId('evidence').textContent = JSON.stringify(
    {
      requestedPath: report.task.file,
      actualReadCalls: report.calls,
      pathMatched: report.pathMatched,
      readFailed: report.readFailed,
      sectionsVerified: report.sectionsVerified,
      dollarNotationAbsent: report.dollarNotationAbsent,
      classroomExample: report.classroomExample,
    },
    null,
    2,
  );
  byId('tool-results').textContent = JSON.stringify(report.toolResults, null, 2);
  const nativeFailure = report.toolResults.find((item) => item.isError);
  byId('error').textContent =
    report.error ||
    (nativeFailure
      ? typeof nativeFailure.content === 'string'
        ? nativeFailure.content
        : JSON.stringify(nativeFailure.content)
      : '');
  byId('error').classList.toggle('hidden', !byId('error').textContent);
  byId('status').textContent = report.verified
    ? report.readFailed
      ? 'Read failed'
      : 'Verified'
    : 'Review';
  byId('status').className =
    'badge ' + (report.verified && !report.readFailed ? 'passed' : 'mismatch');
  byId('progress').textContent =
    'Preserved the actual Read call, native tool results, summary and independently checked source ranges.';
  byId('metadata').textContent = JSON.stringify(
    {
      nativeSessionId: report.sessionId,
      sourceFile: report.sourceFile,
      pathMatched: report.pathMatched,
      schemaPassed: report.schemaPassed,
      sectionsVerified: report.sectionsVerified,
      dollarNotationAbsent: report.dollarNotationAbsent,
      scenarioVerified: report.verified,
    },
    null,
    2,
  );
  byId('download').href = '/api/report/' + report.id;
  byId('download').classList.remove('hidden');
}
async function run() {
  lastReport = undefined;
  for (const id of ['topic', 'mode', 'inspect', 'repair']) byId(id).disabled = true;
  byId('error').classList.add('hidden');
  byId('download').classList.add('hidden');
  byId('status').textContent = 'Running';
  byId('status').className = 'badge';
  byId('progress').textContent =
    'Reading the requested path with the actual native tool, then identifying source sections.';
  byId('answer').textContent = 'Awaiting actual source-grounded output.';
  byId('evidence').textContent = 'Awaiting the actual Read call.';
  byId('tool-results').textContent = '';
  byId('metadata').textContent = '';
  document.querySelectorAll('.target-line').forEach((row) => row.classList.remove('focus'));
  byId('sections').replaceChildren();
  for (const id of ['read-count', 'read-status', 'validation', 'range-status'])
    byId(id).textContent = '—';
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: byId('mode').value, topic: byId('topic').value }),
    });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error);
    displayReport(report);
  } catch (error) {
    byId('status').textContent = 'Stopped';
    byId('error').textContent = error.message;
    byId('error').classList.remove('hidden');
  } finally {
    for (const id of ['topic', 'mode', 'inspect', 'repair']) byId(id).disabled = false;
  }
}
async function restore(id) {
  const response = await fetch('/api/report/' + encodeURIComponent(id));
  if (!response.ok) throw new Error('Saved report unavailable.');
  const report = await response.json();
  byId('mode').value = report.task.mode;
  byId('topic').value = report.task.topic;
  showSelected();
  displayReport(report);
  return report;
}
byId('topic').onchange = showSelected;
byId('mode').onchange = showSelected;
byId('inspect').onclick = run;
byId('repair').onclick = () => {
  byId('mode').value = 'existing';
  showSelected();
};
window.lesson = { showView, source, restore, report: () => lastReport, highlight };
try {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Classroom source unavailable.');
  configuration = await response.json();
  displaySource(configuration.sourceLines);
  showSelected();
  byId('inspect').disabled = false;
  byId('status').textContent = 'Ready';
  byId('progress').textContent =
    'Choose a question and read the actual source with the native tool.';
} catch (error) {
  byId('error').textContent = error.message;
  byId('error').classList.remove('hidden');
}
